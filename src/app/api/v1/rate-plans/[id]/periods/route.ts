import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { addRatePlanPeriodSchema } from "@/lib/validators";
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

  const parsed = addRatePlanPeriodSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const ratePlan = await prisma.ratePlan.findFirst({
    where: { id, unit: { organizationId: session.organizationId } },
  });
  if (!ratePlan) {
    return errorResponse(404, "not_found", "Rate plan not found", reqId);
  }

  const { start_date, end_date, nightly_rate, currency, min_nights, max_nights } = parsed.data;

  if (new Date(end_date) <= new Date(start_date)) {
    return errorResponse(400, "invalid_dates", "end_date must be after start_date", reqId);
  }

  const period = await withOrgContext(session.organizationId, (tx) =>
    tx.ratePlanPeriod.create({
      data: {
        ratePlanId: id,
        startDate: new Date(start_date),
        endDate: new Date(end_date),
        nightlyRate: nightly_rate,
        currency,
        minNights: min_nights,
        maxNights: max_nights,
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "rate_plan_periods.create",
    entityTable: "rate_plan_periods",
    entityId: period.id,
    after: { ratePlanId: id, startDate: start_date, endDate: end_date, nightlyRate: nightly_rate },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(period, reqId, 201);
}
