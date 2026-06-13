import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { logMaintenanceCostSchema } from "@/lib/validators";
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

  const ticket = await prisma.maintenanceTicket.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!ticket) {
    return errorResponse(404, "not_found", "Ticket not found", reqId);
  }

  const costs = await withOrgContext(session.organizationId, (tx) =>
    tx.maintenanceCost.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "desc" },
      include: {
        loggedBy: { select: { id: true, name: true } },
      },
    })
  );

  return jsonResponse({ data: costs }, reqId);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, [
    "org_admin", "property_manager", "agent", "maintenance_staff", "vendor",
  ]);
  if (session instanceof Response) return session;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = logMaintenanceCostSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const ticket = await prisma.maintenanceTicket.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!ticket) {
    return errorResponse(404, "not_found", "Ticket not found", reqId);
  }

  const data = parsed.data;
  const cost = await withOrgContext(session.organizationId, (tx) =>
    tx.maintenanceCost.create({
      data: {
        ticketId: id,
        kind: data.kind,
        description: data.description ?? null,
        hours: data.hours ?? null,
        amountMinor: data.amount_minor,
        currency: data.currency,
        loggedByUserId: session.userId,
      },
      include: {
        loggedBy: { select: { id: true, name: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "maintenance_costs.create",
    entityTable: "maintenance_costs",
    entityId: cost.id,
    after: cost,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(cost, reqId, 201);
}
