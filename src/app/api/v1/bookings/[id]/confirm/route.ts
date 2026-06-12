import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const existing = await prisma.booking.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Booking not found", reqId);
  }

  if (existing.status !== "tentative") {
    return errorResponse(409, "invalid_transition", `Cannot confirm a booking in '${existing.status}' status. Only tentative bookings can be confirmed.`, reqId);
  }

  // Re-check availability for confirmed bookings
  const overlapping = await prisma.booking.count({
    where: {
      unitId: existing.unitId,
      organizationId: session.organizationId,
      status: { in: ["confirmed", "checked_in"] },
      id: { not: id },
      checkIn: { lt: existing.checkOut },
      checkOut: { gt: existing.checkIn },
    },
  });
  if (overlapping > 0) {
    return errorResponse(409, "booking_collision", "Another booking was confirmed for these dates", reqId);
  }

  const booking = await withOrgContext(session.organizationId, (tx) =>
    tx.booking.update({
      where: { id },
      data: { status: "confirmed" },
      include: {
        unit: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, name: true, email: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "bookings.confirm",
    entityTable: "bookings",
    entityId: id,
    before: { status: existing.status },
    after: { status: booking.status },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(booking, reqId);
}
