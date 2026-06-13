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

const eraseSchema = z.object({
  contact_id: z.string().uuid(),
  reason: z.string().min(1).max(500).optional(),
});

/**
 * POST /api/v1/gdpr/erase
 *
 * GDPR erasure (right to be forgotten). Anonymizes PII on the contact
 * while retaining financial records for legal compliance.
 * Org_admin only.
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

  const parsed = eraseSchema.safeParse(body);
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

  // Create GDPR request record
  const gdprRequest = await prisma.gdprRequest.create({
    data: {
      organizationId: auth.organizationId,
      contactId: contact.id,
      requestType: "erase",
      status: "processing",
      requestedById: auth.userId,
      notes: parsed.data.reason || null,
    },
  });

  const beforeData = {
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    address: contact.address,
    idDocumentType: contact.idDocumentType,
    idDocumentNumber: contact.idDocumentNumber,
    notes: contact.notes,
  };

  // Anonymize the contact's PII
  const anonymizedName = `[Erased Contact ${contact.id.slice(0, 8)}]`;
  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      name: anonymizedName,
      email: null,
      phone: null,
      address: null,
      idDocumentType: null,
      idDocumentNumber: null,
      notes: null,
      consentGiven: false,
      deletedAt: new Date(),
    },
  });

  // Deactivate any associated user account
  const associatedUser = await prisma.user.findFirst({
    where: { contactId: contact.id },
  });
  if (associatedUser) {
    await prisma.user.update({
      where: { id: associatedUser.id },
      data: {
        status: "deactivated",
        name: anonymizedName,
        email: `erased-${contact.id.slice(0, 8)}@erased.local`,
      },
    });
    // Revoke all active sessions
    await prisma.session.updateMany({
      where: { userId: associatedUser.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Delete background checks (sensitive data)
  await prisma.backgroundCheck.deleteMany({
    where: { contactId: contact.id },
  });

  // Mark the GDPR request as completed
  await prisma.gdprRequest.update({
    where: { id: gdprRequest.id },
    data: { status: "completed", completedAt: new Date() },
  });

  await writeAuditLog({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: "gdpr_erase",
    entityTable: "contacts",
    entityId: contact.id,
    before: beforeData,
    after: {
      name: anonymizedName,
      gdpr_request_id: gdprRequest.id,
      user_deactivated: !!associatedUser,
    },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(
    {
      gdpr_request_id: gdprRequest.id,
      status: "completed",
      contact_id: contact.id,
      anonymized_name: anonymizedName,
      user_deactivated: !!associatedUser,
      background_checks_deleted: true,
      message: "Contact PII has been anonymized. Financial records retained for legal compliance.",
    },
    reqId
  );
}
