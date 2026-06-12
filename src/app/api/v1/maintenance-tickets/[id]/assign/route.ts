import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { assignTicketSchema } from "@/lib/validators";
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
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = assignTicketSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.maintenanceTicket.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Maintenance ticket not found", reqId);
  }

  if (existing.status === "resolved" || existing.status === "cancelled") {
    return errorResponse(409, "ticket_closed", `Cannot assign a ticket in '${existing.status}' status`, reqId);
  }

  // Validate assignee exists in same org
  const assignee = await prisma.user.findFirst({
    where: { id: parsed.data.assigned_to_user_id, organizationId: session.organizationId },
  });
  if (!assignee) {
    return errorResponse(404, "user_not_found", "Assigned user not found in organization", reqId);
  }

  const ticket = await withOrgContext(session.organizationId, (tx) =>
    tx.maintenanceTicket.update({
      where: { id },
      data: {
        assignedToUserId: parsed.data.assigned_to_user_id,
        status: "in_progress",
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
    action: "maintenance_tickets.assign",
    entityTable: "maintenance_tickets",
    entityId: id,
    before: { status: existing.status, assignedToUserId: existing.assignedToUserId },
    after: { status: ticket.status, assignedToUserId: ticket.assignedToUserId },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(ticket, reqId);
}
