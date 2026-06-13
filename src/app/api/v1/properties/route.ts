import { withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createPropertySchema, paginationSchema } from "@/lib/validators";
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

  const properties = await withOrgContext(session.organizationId, (tx) =>
    tx.property.findMany({
      where: {
        organizationId: session.organizationId,
        status: "active",
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        primaryManager: { select: { id: true, name: true } },
        backupManager: { select: { id: true, name: true } },
        owners: {
          include: { contact: { select: { id: true, name: true } } },
        },
        _count: { select: { units: true } },
      },
    })
  );

  const hasMore = properties.length > limit;
  if (hasMore) properties.pop();

  return jsonResponse(
    {
      data: properties,
      next_cursor: hasMore ? properties[properties.length - 1].id : null,
    },
    reqId
  );
}

export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "property_manager"]);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = createPropertySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  const property = await withOrgContext(session.organizationId, (tx) =>
    tx.property.create({
      data: {
        organizationId: session.organizationId,
        name: data.name,
        addressLine1: data.address_line1,
        city: data.city,
        region: data.region,
        postalCode: data.postal_code,
        country: data.country,
        primaryManagerUserId: data.primary_manager_user_id,
        backupManagerUserId: data.backup_manager_user_id,
        notes: data.notes,
      },
      include: {
        primaryManager: { select: { id: true, name: true } },
        backupManager: { select: { id: true, name: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "properties.create",
    entityTable: "properties",
    entityId: property.id,
    after: property,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(property, reqId, 201);
}
