import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { updateUnitSchema } from "@/lib/validators";
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

  const unit = await withOrgContext(session.organizationId, (tx) =>
    tx.unit.findFirst({
      where: { id, organizationId: session.organizationId, status: "active" },
      include: {
        subUnits: { where: { status: "active" }, select: { id: true, name: true, unitKind: true } },
        parentUnit: { select: { id: true, name: true } },
        ratePlans: { include: { periods: true } },
      },
    })
  );

  if (!unit) {
    return errorResponse(404, "not_found", "Unit not found", reqId);
  }

  return jsonResponse(unit, reqId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = updateUnitSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.unit.findFirst({
    where: { id, organizationId: session.organizationId, status: "active" },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Unit not found", reqId);
  }

  const data = parsed.data;
  const unit = await withOrgContext(session.organizationId, (tx) =>
    tx.unit.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.unit_kind !== undefined && { unitKind: data.unit_kind }),
        ...(data.parent_unit_id !== undefined && { parentUnitId: data.parent_unit_id }),
        ...(data.is_rentable !== undefined && { isRentable: data.is_rentable }),
        ...(data.rental_type !== undefined && { rentalType: data.rental_type }),
        ...(data.address_line1 !== undefined && { addressLine1: data.address_line1 }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.region !== undefined && { region: data.region }),
        ...(data.postal_code !== undefined && { postalCode: data.postal_code }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.bedrooms !== undefined && { bedrooms: data.bedrooms }),
        ...(data.bathrooms !== undefined && { bathrooms: data.bathrooms }),
        ...(data.max_occupancy !== undefined && { maxOccupancy: data.max_occupancy }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "units.update",
    entityTable: "units",
    entityId: unit.id,
    before: existing,
    after: unit,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(unit, reqId);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const existing = await prisma.unit.findFirst({
    where: { id, organizationId: session.organizationId, status: "active" },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Unit not found", reqId);
  }

  // Check for active leases or bookings
  const activeLeases = await prisma.lease.count({
    where: { unitId: id, status: { in: ["draft", "active", "signed"] } },
  });
  if (activeLeases > 0) {
    return errorResponse(409, "unit_has_active_leases", "Cannot archive unit with active leases", reqId);
  }

  const activeBookings = await prisma.booking.count({
    where: { unitId: id, status: { in: ["tentative", "confirmed", "checked_in"] } },
  });
  if (activeBookings > 0) {
    return errorResponse(409, "unit_has_active_bookings", "Cannot archive unit with active bookings", reqId);
  }

  await withOrgContext(session.organizationId, (tx) =>
    tx.unit.update({ where: { id }, data: { status: "archived" } })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "units.archive",
    entityTable: "units",
    entityId: id,
    before: existing,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse({ ok: true }, reqId);
}
