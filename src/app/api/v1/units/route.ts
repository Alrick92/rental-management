import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createUnitSchema, paginationSchema } from "@/lib/validators";
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

  const units = await withOrgContext(session.organizationId, (tx) =>
    tx.unit.findMany({
      where: {
        organizationId: session.organizationId,
        status: "active",
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: { subUnits: { select: { id: true, name: true } } },
    })
  );

  const hasMore = units.length > limit;
  if (hasMore) units.pop();

  return jsonResponse(
    {
      data: units,
      next_cursor: hasMore ? units[units.length - 1].id : null,
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

  const parsed = createUnitSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  if (data.parent_unit_id) {
    const parent = await prisma.unit.findFirst({
      where: { id: data.parent_unit_id, organizationId: session.organizationId },
    });
    if (!parent) {
      return errorResponse(404, "parent_not_found", "Parent unit not found", reqId);
    }
  }

  const unit = await withOrgContext(session.organizationId, (tx) =>
    tx.unit.create({
      data: {
        organizationId: session.organizationId,
        name: data.name,
        unitKind: data.unit_kind,
        parentUnitId: data.parent_unit_id,
        isRentable: data.is_rentable,
        rentalType: data.rental_type,
        addressLine1: data.address_line1,
        city: data.city,
        region: data.region,
        postalCode: data.postal_code,
        country: data.country,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        maxOccupancy: data.max_occupancy,
        notes: data.notes,
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "units.create",
    entityTable: "units",
    entityId: unit.id,
    after: unit,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(unit, reqId, 201);
}
