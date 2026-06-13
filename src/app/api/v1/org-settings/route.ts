import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { updateOrgSettingsSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(_request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      defaultCurrency: true,
      timezone: true,
      managementFeePercent: true,
      invoiceLeadDays: true,
      gracePeriodDays: true,
      status: true,
    },
  });

  if (!org) {
    return errorResponse(404, "not_found", "Organization not found", reqId);
  }

  return jsonResponse(
    {
      id: org.id,
      name: org.name,
      slug: org.slug,
      default_currency: org.defaultCurrency,
      timezone: org.timezone,
      management_fee_percent: org.managementFeePercent,
      invoice_lead_days: org.invoiceLeadDays,
      grace_period_days: org.gracePeriodDays,
      status: org.status,
    },
    reqId
  );
}

export async function PATCH(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = updateOrgSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  const before = await prisma.organization.findUnique({
    where: { id: session.organizationId },
  });

  const org = await prisma.organization.update({
    where: { id: session.organizationId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.default_currency !== undefined
        ? { defaultCurrency: data.default_currency }
        : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.management_fee_percent !== undefined
        ? { managementFeePercent: data.management_fee_percent }
        : {}),
      ...(data.invoice_lead_days !== undefined
        ? { invoiceLeadDays: data.invoice_lead_days }
        : {}),
      ...(data.grace_period_days !== undefined
        ? { gracePeriodDays: data.grace_period_days }
        : {}),
    },
  });

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "org_settings.update",
    entityTable: "organizations",
    entityId: session.organizationId,
    before: before
      ? {
          name: before.name,
          default_currency: before.defaultCurrency,
          timezone: before.timezone,
          management_fee_percent: before.managementFeePercent,
          invoice_lead_days: before.invoiceLeadDays,
          grace_period_days: before.gracePeriodDays,
        }
      : undefined,
    after: {
      name: org.name,
      default_currency: org.defaultCurrency,
      timezone: org.timezone,
      management_fee_percent: org.managementFeePercent,
      invoice_lead_days: org.invoiceLeadDays,
      grace_period_days: org.gracePeriodDays,
    },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(
    {
      id: org.id,
      name: org.name,
      slug: org.slug,
      default_currency: org.defaultCurrency,
      timezone: org.timezone,
      management_fee_percent: org.managementFeePercent,
      invoice_lead_days: org.invoiceLeadDays,
      grace_period_days: org.gracePeriodDays,
      status: org.status,
    },
    reqId
  );
}
