import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { updateBookingSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
  if (session instanceof Response) return session;

  const { id } = await params;

  const booking = await withOrgContext(session.organizationId, (tx) =>
    tx.booking.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        unit: { select: { id: true, name: true, unitKind: true, addressLine1: true, city: true } },
        primaryContact: { select: { id: true, name: true, email: true, phone: true } },
        guests: {
          include: { contact: { select: { id: true, name: true } } },
        },
        payments: {
          select: { id: true, amountMinor: true, currency: true, method: true, receivedAt: true },
          orderBy: { receivedAt: "desc" },
          take: 20,
        },
      },
    })
  );

  if (!booking) {
    return errorResponse(404, "not_found", "Booking not found", reqId);
  }

  return jsonResponse(booking, reqId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = updateBookingSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.booking.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Booking not found", reqId);
  }

  if (existing.status === "cancelled" || existing.status === "checked_out") {
    return errorResponse(409, "booking_closed", "Cannot modify a completed or cancelled booking", reqId);
  }

  // Channel is read-only after check-in
  const data = parsed.data;
  if (data.channel !== undefined && existing.status === "checked_in") {
    return errorResponse(409, "channel_immutable", "Channel cannot be changed after check-in", reqId);
  }

  const updateData: Record<string, unknown> = {};
  if (data.check_in !== undefined) updateData.checkIn = new Date(data.check_in);
  if (data.check_out !== undefined) updateData.checkOut = new Date(data.check_out);
  if (data.nightly_rate_minor !== undefined) updateData.nightlyRateMinor = data.nightly_rate_minor;
  if (data.total_amount_minor !== undefined) updateData.totalAmountMinor = data.total_amount_minor;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.channel !== undefined) updateData.channel = data.channel;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const booking = await withOrgContext(session.organizationId, (tx) =>
    tx.booking.update({
      where: { id },
      data: updateData,
      include: {
        unit: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, name: true, email: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "bookings.update",
    entityTable: "bookings",
    entityId: booking.id,
    before: existing,
    after: booking,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(booking, reqId);
}
