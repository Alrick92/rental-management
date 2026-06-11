import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { updateContactSchema } from "@/lib/validators";
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

  const contact = await withOrgContext(session.organizationId, (tx) =>
    tx.contact.findFirst({
      where: { id, organizationId: session.organizationId, deletedAt: null },
      include: {
        leaseTenants: {
          include: { lease: { select: { id: true, status: true, startDate: true, endDate: true } } },
        },
        primaryBookings: {
          select: { id: true, status: true, checkIn: true, checkOut: true },
          where: { status: { not: "cancelled" } },
          take: 10,
          orderBy: { checkIn: "desc" },
        },
      },
    })
  );

  if (!contact) {
    return errorResponse(404, "not_found", "Contact not found", reqId);
  }

  return jsonResponse(contact, reqId);
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

  const parsed = updateContactSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.contact.findFirst({
    where: { id, organizationId: session.organizationId, deletedAt: null },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Contact not found", reqId);
  }

  const data = parsed.data;
  const contact = await withOrgContext(session.organizationId, (tx) =>
    tx.contact.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.id_document_type !== undefined && { idDocumentType: data.id_document_type }),
        ...(data.id_document_number !== undefined && { idDocumentNumber: data.id_document_number }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "contacts.update",
    entityTable: "contacts",
    entityId: contact.id,
    before: existing,
    after: contact,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(contact, reqId);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const existing = await prisma.contact.findFirst({
    where: { id, organizationId: session.organizationId, deletedAt: null },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Contact not found", reqId);
  }

  // Check for open leases
  const openLeases = await prisma.leaseTenant.count({
    where: {
      contactId: id,
      lease: { status: { in: ["draft", "active", "signed"] } },
    },
  });
  if (openLeases > 0) {
    return errorResponse(409, "contact_has_open_leases", "Cannot delete contact with open leases", reqId);
  }

  // Check for active bookings
  const activeBookings = await prisma.booking.count({
    where: {
      primaryContactId: id,
      status: { in: ["tentative", "confirmed", "checked_in"] },
    },
  });
  if (activeBookings > 0) {
    return errorResponse(409, "contact_has_active_bookings", "Cannot delete contact with active bookings", reqId);
  }

  // Soft delete
  await withOrgContext(session.organizationId, (tx) =>
    tx.contact.update({ where: { id }, data: { deletedAt: new Date() } })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "contacts.delete",
    entityTable: "contacts",
    entityId: id,
    before: existing,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse({ ok: true }, reqId);
}
