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

  if (existing.status !== "confirmed") {
    return errorResponse(409, "invalid_transition", `Cannot check in a booking in '${existing.status}' status. Only confirmed bookings can be checked in.`, reqId);
  }

  const booking = await withOrgContext(session.organizationId, (tx) =>
    tx.booking.update({
      where: { id },
      data: {
        status: "checked_in",
        checkInActualAt: new Date(),
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
    action: "bookings.check_in",
    entityTable: "bookings",
    entityId: id,
    before: { status: existing.status },
    after: { status: booking.status, checkInActualAt: booking.checkInActualAt },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(booking, reqId);
}
