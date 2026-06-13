import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { tenantPaymentSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

/**
 * POST /api/v1/tenant/payments
 *
 * Tenant submits a payment for approval. Payment is created with status `pending`.
 * A manager must approve it before it counts toward the balance.
 */
export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["tenant"]);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = tenantPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  // Find the tenant's contact and active lease
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { contactId: true },
  });

  if (!user?.contactId) {
    return errorResponse(400, "no_contact", "Tenant has no linked contact", reqId);
  }

  // Find an active lease for this tenant
  const leaseTenant = await withOrgContext(session.organizationId, (tx) =>
    tx.leaseTenant.findFirst({
      where: { contactId: user.contactId! },
      select: {
        lease: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })
  );

  const activeLease = leaseTenant?.lease;
  if (!activeLease || !["active", "signed"].includes(activeLease.status)) {
    return errorResponse(400, "no_active_lease", "No active lease found", reqId);
  }

  const payment = await withOrgContext(session.organizationId, (tx) =>
    tx.payment.create({
      data: {
        organizationId: session.organizationId,
        leaseId: activeLease.id,
        contactId: user.contactId!,
        amountMinor: data.amount_minor,
        currency: data.currency,
        method: data.method,
        reference: data.reference ?? null,
        status: "pending",
        receivedAt: new Date(),
        recordedByUserId: session.userId,
        notes: data.notes ?? null,
      },
      select: {
        id: true,
        amountMinor: true,
        currency: true,
        method: true,
        status: true,
        receivedAt: true,
        createdAt: true,
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "tenant.payments.submit",
    entityTable: "payments",
    entityId: payment.id,
    after: payment,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(payment, reqId, 201);
}
