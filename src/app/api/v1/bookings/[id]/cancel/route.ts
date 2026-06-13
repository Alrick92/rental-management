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

  const { id } = await params;

  // First authenticate
  const session = await requireAuth(reqId, ["org_admin", "property_manager", "agent"]);
  if (session instanceof Response) return session;

  const existing = await prisma.booking.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Booking not found", reqId);
  }

  // Only org_admin can cancel confirmed bookings
  if (existing.status === "confirmed" && session.role !== "org_admin") {
    return errorResponse(403, "forbidden", "Only org_admin can cancel confirmed bookings", reqId);
  }

  if (existing.status === "checked_in") {
    return errorResponse(409, "invalid_transition", "Cannot cancel a checked-in booking. Use check-out instead.", reqId);
  }

  if (!["tentative", "confirmed"].includes(existing.status)) {
    return errorResponse(409, "invalid_transition", `Cannot cancel a booking in '${existing.status}' status`, reqId);
  }

  const booking = await withOrgContext(session.organizationId, (tx) =>
    tx.booking.update({
      where: { id },
      data: { status: "cancelled" },
      include: {
        unit: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, name: true, email: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "bookings.cancel",
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
