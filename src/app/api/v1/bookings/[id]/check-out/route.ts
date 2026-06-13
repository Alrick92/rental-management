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
  const session = await requireAuth(reqId, ["org_admin", "property_manager", "agent"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const existing = await prisma.booking.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Booking not found", reqId);
  }

  if (existing.status !== "checked_in") {
    return errorResponse(409, "invalid_transition", `Cannot check out a booking in '${existing.status}' status. Only checked-in bookings can be checked out.`, reqId);
  }

  const booking = await withOrgContext(session.organizationId, (tx) =>
    tx.booking.update({
      where: { id },
      data: {
        status: "checked_out",
        checkOutActualAt: new Date(),
      },
      include: {
        unit: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, name: true, email: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "bookings.check_out",
    entityTable: "bookings",
    entityId: id,
    before: { status: existing.status },
    after: { status: booking.status, checkOutActualAt: booking.checkOutActualAt },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(booking, reqId);
}
