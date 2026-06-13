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

  const existing = await prisma.maintenanceTicket.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Maintenance ticket not found", reqId);
  }

  if (!["open", "in_progress"].includes(existing.status)) {
    return errorResponse(409, "invalid_transition", `Cannot resolve a ticket in '${existing.status}' status`, reqId);
  }

  const ticket = await withOrgContext(session.organizationId, (tx) =>
    tx.maintenanceTicket.update({
      where: { id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
      },
      include: {
        unit: { select: { id: true, name: true } },
        reportedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "maintenance_tickets.resolve",
    entityTable: "maintenance_tickets",
    entityId: id,
    before: { status: existing.status },
    after: { status: ticket.status, resolvedAt: ticket.resolvedAt },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(ticket, reqId);
}
