import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createTicketSchema, paginationSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid pagination params", reqId, {
      issues: parsed.error.issues,
    });
  }
  const { cursor, limit } = parsed.data;
  const statusFilter = url.searchParams.get("status");
  const priorityFilter = url.searchParams.get("priority");
  const unitFilter = url.searchParams.get("unit_id");

  const tickets = await withOrgContext(session.organizationId, (tx) =>
    tx.maintenanceTicket.findMany({
      where: {
        organizationId: session.organizationId,
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(statusFilter ? { status: statusFilter as never } : {}),
        ...(priorityFilter ? { priority: priorityFilter as never } : {}),
        ...(unitFilter ? { unitId: unitFilter } : {}),
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: limit + 1,
      include: {
        unit: { select: { id: true, name: true } },
        reportedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })
  );

  const hasMore = tickets.length > limit;
  if (hasMore) tickets.pop();

  return jsonResponse(
    {
      data: tickets,
      next_cursor: hasMore ? tickets[tickets.length - 1].id : null,
    },
    reqId
  );
}

export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  // Validate unit exists
  const unit = await prisma.unit.findFirst({
    where: { id: data.unit_id, organizationId: session.organizationId },
  });
  if (!unit) {
    return errorResponse(404, "unit_not_found", "Unit not found", reqId);
  }

  // Validate contact if provided
  if (data.reported_by_contact_id) {
    const contact = await prisma.contact.findFirst({
      where: { id: data.reported_by_contact_id, organizationId: session.organizationId, deletedAt: null },
    });
    if (!contact) {
      return errorResponse(404, "contact_not_found", "Reporting contact not found", reqId);
    }
  }

  const ticket = await withOrgContext(session.organizationId, (tx) =>
    tx.maintenanceTicket.create({
      data: {
        organizationId: session.organizationId,
        unitId: data.unit_id,
        reportedByContactId: data.reported_by_contact_id ?? null,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
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
    action: "maintenance_tickets.create",
    entityTable: "maintenance_tickets",
    entityId: ticket.id,
    after: ticket,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(ticket, reqId, 201);
}
