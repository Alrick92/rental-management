import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { updateCurrencySchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = updateCurrencySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.currency.findFirst({
    where: { id, organizationId: session.organizationId },
  });

  if (!existing) {
    return errorResponse(404, "not_found", "Currency not found", reqId);
  }

  const data = parsed.data;
  const currency = await prisma.currency.update({
    where: { id },
    data: {
      ...(data.symbol !== undefined ? { symbol: data.symbol } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.decimal_places !== undefined ? { decimalPlaces: data.decimal_places } : {}),
    },
  });

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "currency.update",
    entityTable: "currencies",
    entityId: currency.id,
    before: { symbol: existing.symbol, name: existing.name, decimal_places: existing.decimalPlaces },
    after: { symbol: currency.symbol, name: currency.name, decimal_places: currency.decimalPlaces },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(
    {
      id: currency.id,
      code: currency.code,
      symbol: currency.symbol,
      name: currency.name,
      decimal_places: currency.decimalPlaces,
      is_custom: currency.isCustom,
      created_at: currency.createdAt.toISOString(),
    },
    reqId
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const { id } = await context.params;

  const existing = await prisma.currency.findFirst({
    where: { id, organizationId: session.organizationId },
  });

  if (!existing) {
    return errorResponse(404, "not_found", "Currency not found", reqId);
  }

  if (!existing.isCustom) {
    return errorResponse(400, "cannot_delete", "Cannot delete built-in currencies", reqId);
  }

  await prisma.currency.delete({ where: { id } });

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "currency.delete",
    entityTable: "currencies",
    entityId: id,
    before: { code: existing.code, symbol: existing.symbol, name: existing.name },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse({ deleted: true }, reqId);
}
