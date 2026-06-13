import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";
import { z } from "zod/v4";

const exportSchema = z.object({
  contact_id: z.string().uuid(),
});

/**
 * POST /api/v1/gdpr/export
 *
 * Generate a GDPR data export for a contact. Collects all PII and related
 * records into a JSON bundle. Org_admin only.
 */
export async function POST(request: Request) {
  const reqId = requestId();
  const auth = await requireAuth(reqId, ["org_admin"]);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON", reqId);
  }

  const parsed = exportSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const contact = await withOrgContext(auth.organizationId, () =>
    prisma.contact.findFirst({
      where: {
        id: parsed.data.contact_id,
        organizationId: auth.organizationId,
        deletedAt: null,
      },
    })
  );

  if (!contact) {
    return errorResponse(404, "not_found", "Contact not found", reqId);
  }

  // Fetch related data separately to avoid type complexity
  const leaseTenants = await prisma.leaseTenant.findMany({
    where: { contactId: contact.id },
    include: {
      lease: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          monthlyRentMinor: true,
          currency: true,
          status: true,
        },
      },
    },
  });

  const bookingGuests = await prisma.bookingGuest.findMany({
    where: { contactId: contact.id },
    include: {
      booking: {
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          status: true,
        },
      },
    },
  });

  const payments = await prisma.payment.findMany({
    where: { contactId: contact.id },
    select: {
      id: true,
      amountMinor: true,
      currency: true,
      status: true,
      createdAt: true,
    },
  });

  const reportedTickets = await prisma.maintenanceTicket.findMany({
    where: { reportedByContactId: contact.id },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
    },
  });

  const backgroundChecks = await prisma.backgroundCheck.findMany({
    where: { contactId: contact.id },
    select: {
      id: true,
      checkType: true,
      status: true,
      performedAt: true,
    },
  });

  const exportData = {
    export_generated_at: new Date().toISOString(),
    contact: {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      address: contact.address,
      id_document_type: contact.idDocumentType,
      id_document_number: contact.idDocumentNumber,
      consent_given: contact.consentGiven,
      consent_at: contact.consentAt?.toISOString() || null,
      notes: contact.notes,
      created_at: contact.createdAt.toISOString(),
    },
    leases: leaseTenants.map((lt) => ({
      lease_id: lt.lease.id,
      role: lt.role,
      start_date: lt.lease.startDate.toISOString(),
      end_date: lt.lease.endDate.toISOString(),
      rent_amount: lt.lease.monthlyRentMinor,
      currency: lt.lease.currency,
      status: lt.lease.status,
    })),
    bookings: bookingGuests.map((bg) => ({
      booking_id: bg.booking.id,
      check_in: bg.booking.checkIn.toISOString(),
      check_out: bg.booking.checkOut.toISOString(),
      status: bg.booking.status,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amountMinor,
      currency: p.currency,
      status: p.status,
      created_at: p.createdAt.toISOString(),
    })),
    maintenance_requests: reportedTickets.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      created_at: t.createdAt.toISOString(),
    })),
    background_checks: backgroundChecks.map((bc) => ({
      id: bc.id,
      check_type: bc.checkType,
      status: bc.status,
      performed_at: bc.performedAt.toISOString(),
    })),
  };

  // Create GDPR request record
  const gdprRequest = await prisma.gdprRequest.create({
    data: {
      organizationId: auth.organizationId,
      contactId: contact.id,
      requestType: "export",
      status: "completed",
      requestedById: auth.userId,
      completedAt: new Date(),
      exportData: exportData as object,
    },
  });

  await writeAuditLog({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: "gdpr_export",
    entityTable: "contacts",
    entityId: contact.id,
    after: { gdpr_request_id: gdprRequest.id },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(
    {
      gdpr_request_id: gdprRequest.id,
      status: "completed",
      export_data: exportData,
    },
    reqId,
    200
  );
}
