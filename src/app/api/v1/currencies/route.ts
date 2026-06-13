import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createCurrencySchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(_request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, [
    "org_admin",
    "property_manager",
    "agent",
    "landlord",
    "tenant",
  ]);
  if (session instanceof Response) return session;

  const currencies = await prisma.currency.findMany({
    where: { organizationId: session.organizationId },
    orderBy: [{ isCustom: "asc" }, { code: "asc" }],
  });

  return jsonResponse(
    currencies.map((c) => ({
      id: c.id,
      code: c.code,
      symbol: c.symbol,
      name: c.name,
      decimal_places: c.decimalPlaces,
      is_custom: c.isCustom,
      created_at: c.createdAt.toISOString(),
    })),
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

  const parsed = createCurrencySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const { code, symbol, name, decimal_places } = parsed.data;

  const existing = await prisma.currency.findUnique({
    where: { organizationId_code: { organizationId: session.organizationId, code } },
  });

  if (existing) {
    return errorResponse(409, "duplicate", `Currency ${code} already exists`, reqId);
  }

  const currency = await prisma.currency.create({
    data: {
      organizationId: session.organizationId,
      code,
      symbol,
      name,
      decimalPlaces: decimal_places,
      isCustom: true,
    },
  });

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "currency.create",
    entityTable: "currencies",
    entityId: currency.id,
    after: { code, symbol, name, decimal_places },
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
    reqId,
    201
  );
}
