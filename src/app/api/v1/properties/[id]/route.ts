import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { updatePropertySchema } from "@/lib/validators";
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

  const property = await withOrgContext(session.organizationId, (tx) =>
    tx.property.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        primaryManager: { select: { id: true, name: true } },
        backupManager: { select: { id: true, name: true } },
        owners: {
          include: { contact: { select: { id: true, name: true, email: true } } },
        },
        units: {
          where: { status: "active" },
          select: { id: true, name: true, unitKind: true, isRentable: true },
        },
        propertyAmenities: {
          include: { amenity: { select: { id: true, name: true, icon: true } } },
        },
      },
    })
  );

  if (!property) {
    return errorResponse(404, "not_found", "Property not found", reqId);
  }

  return jsonResponse(property, reqId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "property_manager"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = updatePropertySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.property.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Property not found", reqId);
  }

  const data = parsed.data;
  const property = await withOrgContext(session.organizationId, (tx) =>
    tx.property.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.address_line1 !== undefined && { addressLine1: data.address_line1 }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.region !== undefined && { region: data.region }),
        ...(data.postal_code !== undefined && { postalCode: data.postal_code }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.primary_manager_user_id !== undefined && { primaryManagerUserId: data.primary_manager_user_id }),
        ...(data.backup_manager_user_id !== undefined && { backupManagerUserId: data.backup_manager_user_id }),
        ...(data.notes !== undefined && { notes: data.notes }),
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
    action: "properties.update",
    entityTable: "properties",
    entityId: id,
    before: existing,
    after: property,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(property, reqId);
}
