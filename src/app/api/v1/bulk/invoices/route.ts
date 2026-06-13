import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

/**
 * POST /api/v1/bulk/invoices
 *
 * Bulk generate invoices for all active leases. Wrapper around the
 * existing invoice generation logic. Org_admin and property_manager only.
 */
export async function POST(request: Request) {
  const reqId = requestId();
  const auth = await requireAuth(reqId, ["org_admin", "property_manager"]);
  if (auth instanceof Response) return auth;

  const org = await prisma.organization.findUnique({
    where: { id: auth.organizationId },
    select: { invoiceLeadDays: true, gracePeriodDays: true },
  });

  if (!org) {
    return errorResponse(404, "org_not_found", "Organization not found", reqId);
  }

  const now = new Date();
  const leadDate = new Date(now);
  leadDate.setDate(leadDate.getDate() + org.invoiceLeadDays);

  const leases = await withOrgContext(auth.organizationId, () =>
    prisma.lease.findMany({
      where: {
        organizationId: auth.organizationId,
        status: { in: ["active", "signed"] },
        startDate: { lte: leadDate },
        endDate: { gte: now },
      },
      include: {
        unit: { select: { id: true, name: true } },
        tenants: {
          where: { role: "primary" },
          include: { contact: { select: { name: true } } },
        },
      },
    })
  );

  const results: Array<{
    lease_id: string;
    status: "created" | "skipped";
    invoice_id?: string;
    reason?: string;
  }> = [];

  let createdCount = 0;

  for (const lease of leases) {
    // Calculate the current billing period
    const leaseStart = new Date(lease.startDate);
    const periodStart = new Date(now.getFullYear(), now.getMonth(), leaseStart.getDate());
    if (periodStart > now) {
      periodStart.setMonth(periodStart.getMonth() - 1);
    }
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(periodEnd.getDate() - 1);

    // Check idempotency
    const existing = await prisma.invoice.findFirst({
      where: {
        leaseId: lease.id,
        periodStart: periodStart,
      },
    });

    if (existing) {
      results.push({
        lease_id: lease.id,
        status: "skipped",
        reason: "Invoice already exists for this period",
      });
      continue;
    }

    const dueDate = new Date(periodStart);
    dueDate.setDate(1);

    const invoice = await prisma.invoice.create({
      data: {
        organizationId: auth.organizationId,
        leaseId: lease.id,
        amountDueMinor: lease.monthlyRentMinor,
        amountPaidMinor: 0,
        periodStart,
        periodEnd,
        dueDate,
        status: "sent",
      },
    });

    createdCount++;
    results.push({
      lease_id: lease.id,
      status: "created",
      invoice_id: invoice.id,
    });
  }

  await writeAuditLog({
    organizationId: auth.organizationId,
    userId: auth.userId,
    action: "bulk_generate_invoices",
    entityTable: "invoices",
    entityId: auth.organizationId,
    after: {
      leases_checked: leases.length,
      invoices_created: createdCount,
      invoices_skipped: leases.length - createdCount,
    },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(
    {
      leases_checked: leases.length,
      invoices_created: createdCount,
      invoices_skipped: leases.length - createdCount,
      results,
    },
    reqId,
    201
  );
}
