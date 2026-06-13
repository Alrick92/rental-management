import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { generateInvoicesSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

/**
 * POST /api/v1/invoices/generate
 *
 * Idempotent invoice generation for active/signed leases.
 * For each lease, generates an invoice for the next billing period
 * if one doesn't already exist and the due date is within `invoiceLeadDays`.
 */
export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "property_manager"]);
  if (session instanceof Response) return session;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = generateInvoicesSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const asOfDate = parsed.data.as_of_date
    ? new Date(parsed.data.as_of_date)
    : new Date();

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { invoiceLeadDays: true, defaultCurrency: true },
  });
  if (!org) {
    return errorResponse(404, "org_not_found", "Organization not found", reqId);
  }

  const leases = await withOrgContext(session.organizationId, (tx) =>
    tx.lease.findMany({
      where: {
        organizationId: session.organizationId,
        status: { in: ["active", "signed"] },
      },
      include: {
        invoices: {
          orderBy: { periodEnd: "desc" },
          take: 1,
        },
      },
    })
  );

  const created: string[] = [];

  for (const lease of leases) {
    const lastInvoice = lease.invoices[0];

    let periodStart: Date;
    let periodEnd: Date;

    if (lastInvoice) {
      // Next period starts after the last invoice's period end
      periodStart = new Date(lastInvoice.periodEnd);
      periodStart.setDate(periodStart.getDate() + 1);
    } else {
      // First invoice: period starts at lease start
      periodStart = new Date(lease.startDate);
    }

    // Period end is one month from period start
    periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(periodEnd.getDate() - 1);

    // Don't generate invoices past lease end
    if (periodStart > new Date(lease.endDate)) continue;
    if (periodEnd > new Date(lease.endDate)) {
      periodEnd = new Date(lease.endDate);
    }

    // Due date is the rent_due_day of the period start month
    const dueDate = new Date(periodStart);
    dueDate.setDate(lease.rentDueDay);

    // Only generate if due date is within lead days of as_of_date
    const leadMs = org.invoiceLeadDays * 24 * 60 * 60 * 1000;
    const generateThreshold = new Date(asOfDate.getTime() + leadMs);
    if (dueDate > generateThreshold) continue;

    // Idempotent: check if invoice already exists for this period
    const existing = await withOrgContext(session.organizationId, (tx) =>
      tx.invoice.findFirst({
        where: {
          organizationId: session.organizationId,
          leaseId: lease.id,
          periodStart: periodStart,
        },
      })
    );
    if (existing) continue;

    const invoice = await withOrgContext(session.organizationId, (tx) =>
      tx.invoice.create({
        data: {
          organizationId: session.organizationId,
          leaseId: lease.id,
          periodStart,
          periodEnd,
          amountDueMinor: lease.monthlyRentMinor,
          dueDate,
          status: "sent",
          sentAt: new Date(),
        },
      })
    );

    created.push(invoice.id);
  }

  if (created.length > 0) {
    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "invoices.generate",
      entityTable: "invoices",
      entityId: created[0],
      after: { count: created.length, ids: created },
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      requestId: reqId,
    });
  }

  return jsonResponse(
    { generated: created.length, invoice_ids: created },
    reqId,
    201
  );
}
