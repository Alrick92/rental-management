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

const bulkContactSchema = z.object({
  contacts: z.array(
    z.object({
      name: z.string().min(1).max(255),
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
      address: z.string().max(500).optional(),
      notes: z.string().max(5000).optional(),
    })
  ).min(1).max(500),
});

/**
 * POST /api/v1/bulk/contacts
 *
 * Batch create contacts. Org_admin and property_manager only.
 * Skips duplicates by email (within the org).
 */
export async function POST(request: Request) {
  const reqId = requestId();
  const auth = await requireAuth(reqId, ["org_admin", "property_manager"]);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON", reqId);
  }

  const parsed = bulkContactSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const results: Array<{
    index: number;
    status: "created" | "skipped";
    contact_id?: string;
    reason?: string;
  }> = [];

  // Get existing emails in org to skip duplicates
  const existingEmails = new Set<string>();
  const existingContacts = await withOrgContext(auth.organizationId, () =>
    prisma.contact.findMany({
      where: {
        organizationId: auth.organizationId,
        email: { not: null },
        deletedAt: null,
      },
      select: { email: true },
    })
  );
  for (const c of existingContacts) {
    if (c.email) existingEmails.add(c.email.toLowerCase());
  }

  let createdCount = 0;
  for (let i = 0; i < parsed.data.contacts.length; i++) {
    const input = parsed.data.contacts[i]!;

    if (input.email && existingEmails.has(input.email.toLowerCase())) {
      results.push({
        index: i,
        status: "skipped",
        reason: `Email ${input.email} already exists`,
      });
      continue;
    }

    const contact = await prisma.contact.create({
      data: {
        organizationId: auth.organizationId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        notes: input.notes || null,
      },
    });

    if (input.email) existingEmails.add(input.email.toLowerCase());
    createdCount++;

    results.push({
      index: i,
      status: "created",
      contact_id: contact.id,
    });
  }

  await writeAuditLog({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: "bulk_create",
    entityTable: "contacts",
    entityId: auth.organizationId,
    after: {
      total_requested: parsed.data.contacts.length,
      created: createdCount,
      skipped: parsed.data.contacts.length - createdCount,
    },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(
    {
      total: parsed.data.contacts.length,
      created: createdCount,
      skipped: parsed.data.contacts.length - createdCount,
      results,
    },
    reqId,
    201
  );
}
