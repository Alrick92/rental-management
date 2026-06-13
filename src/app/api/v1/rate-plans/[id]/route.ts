import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { updateRatePlanSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const ratePlan = await withOrgContext(session.organizationId, (tx) =>
    tx.ratePlan.findFirst({
      where: { id, unit: { organizationId: session.organizationId } },
      include: {
        unit: { select: { id: true, name: true } },
        periods: { orderBy: { startDate: "asc" } },
      },
    })
  );

  if (!ratePlan) {
    return errorResponse(404, "not_found", "Rate plan not found", reqId);
  }

  return jsonResponse(ratePlan, reqId);
}

export async function PATCH(
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

  const parsed = updateRatePlanSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.ratePlan.findFirst({
    where: { id, unit: { organizationId: session.organizationId } },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Rate plan not found", reqId);
  }

  // If setting as default, unset existing defaults for this unit
  if (parsed.data.is_default === true) {
    await withOrgContext(session.organizationId, (tx) =>
      tx.ratePlan.updateMany({
        where: { unitId: existing.unitId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
  if (parsed.data.is_default !== undefined) data.isDefault = parsed.data.is_default;

  const ratePlan = await withOrgContext(session.organizationId, (tx) =>
    tx.ratePlan.update({
      where: { id },
      data,
      include: {
        unit: { select: { id: true, name: true } },
        periods: { orderBy: { startDate: "asc" } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "rate_plans.update",
    entityTable: "rate_plans",
    entityId: id,
    before: { name: existing.name, priority: existing.priority, isDefault: existing.isDefault },
    after: { name: ratePlan.name, priority: ratePlan.priority, isDefault: ratePlan.isDefault },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(ratePlan, reqId);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const existing = await prisma.ratePlan.findFirst({
    where: { id, unit: { organizationId: session.organizationId } },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Rate plan not found", reqId);
  }

  await withOrgContext(session.organizationId, (tx) =>
    tx.ratePlanPeriod.deleteMany({ where: { ratePlanId: id } })
  );

  await withOrgContext(session.organizationId, (tx) =>
    tx.ratePlan.delete({ where: { id } })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "rate_plans.delete",
    entityTable: "rate_plans",
    entityId: id,
    before: { name: existing.name, unitId: existing.unitId },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse({ deleted: true }, reqId);
}
