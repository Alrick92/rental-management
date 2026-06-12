import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { updateTicketSchema } from "@/lib/validators";
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

  const ticket = await withOrgContext(session.organizationId, (tx) =>
    tx.maintenanceTicket.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        unit: { select: { id: true, name: true } },
        reportedBy: { select: { id: true, name: true, email: true, phone: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
        },
      },
    })
  );

  if (!ticket) {
    return errorResponse(404, "not_found", "Maintenance ticket not found", reqId);
  }

  return jsonResponse(ticket, reqId);
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

  const parsed = updateTicketSchema.safeParse(body);
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
    return errorResponse(409, "ticket_closed", `Cannot update a ticket in '${existing.status}' status`, reqId);
  }

  const data = parsed.data;
  const ticket = await withOrgContext(session.organizationId, (tx) =>
    tx.maintenanceTicket.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
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
    action: "maintenance_tickets.update",
    entityTable: "maintenance_tickets",
    entityId: id,
    before: existing,
    after: ticket,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(ticket, reqId);
}
