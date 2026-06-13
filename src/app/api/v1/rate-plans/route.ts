import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createRatePlanSchema, paginationSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid query parameters", reqId);
  }

  const unitId = url.searchParams.get("unit_id");

  const where: Record<string, unknown> = {};
  if (unitId) where.unitId = unitId;
  if (parsed.data.cursor) where.id = { gt: parsed.data.cursor };

  // Rate plans don't have org_id directly; filter via unit's org
  const data = await withOrgContext(session.organizationId, (tx) =>
    tx.ratePlan.findMany({
      where: {
        ...where,
        unit: { organizationId: session.organizationId },
      },
      take: parsed.data.limit,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        unit: { select: { id: true, name: true } },
        periods: {
          orderBy: { startDate: "asc" },
        },
      },
    })
  );

  return jsonResponse(
    { data, next_cursor: data.length === parsed.data.limit ? data[data.length - 1]?.id : null },
    reqId
  );
}

export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = createRatePlanSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const { unit_id, name, priority, is_default, periods } = parsed.data;

  const unit = await prisma.unit.findFirst({
    where: { id: unit_id, organizationId: session.organizationId },
  });
  if (!unit) {
    return errorResponse(404, "not_found", "Unit not found", reqId);
  }

  if (unit.rentalType !== "short_term" && unit.rentalType !== "both") {
    return errorResponse(400, "invalid_unit_type", "Rate plans can only be created for short-term or both rental types", reqId);
  }

  // Validate period dates
  for (const period of periods) {
    if (new Date(period.end_date) <= new Date(period.start_date)) {
      return errorResponse(400, "invalid_dates", "Period end_date must be after start_date", reqId);
    }
  }

  // If setting as default, unset existing defaults for this unit
  if (is_default) {
    await withOrgContext(session.organizationId, (tx) =>
      tx.ratePlan.updateMany({
        where: { unitId: unit_id, isDefault: true },
        data: { isDefault: false },
      })
    );
  }

  const ratePlan = await withOrgContext(session.organizationId, (tx) =>
    tx.ratePlan.create({
      data: {
        unitId: unit_id,
        name,
        priority: priority ?? 0,
        isDefault: is_default ?? false,
        periods: {
          create: periods.map((p) => ({
            startDate: new Date(p.start_date),
            endDate: new Date(p.end_date),
            nightlyRate: p.nightly_rate,
            currency: p.currency,
            minNights: p.min_nights,
            maxNights: p.max_nights,
          })),
        },
      },
      include: {
        unit: { select: { id: true, name: true } },
        periods: true,
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "rate_plans.create",
    entityTable: "rate_plans",
    entityId: ratePlan.id,
    after: { unitId: unit_id, name, priority, isDefault: is_default, periodCount: periods.length },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(ratePlan, reqId, 201);
}
