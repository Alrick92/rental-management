import { withOrgContext } from "@/lib/db";
import {
  requestId,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

/**
 * GET /api/v1/tenant/balance
 *
 * Returns the tenant's outstanding balance, next payment date,
 * and recent invoice/payment history.
 */
export async function GET() {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["tenant"]);
  if (session instanceof Response) return session;

  // Find the tenant's active lease via their contact
  const user = await withOrgContext(session.organizationId, (tx) =>
    tx.user.findUnique({
      where: { id: session.userId },
      select: { contactId: true },
    })
  );

  if (!user?.contactId) {
    return jsonResponse(
      { balance_due: 0, next_due_date: null, invoices: [], payments: [] },
      reqId
    );
  }

  // Find active leases for this tenant
  const leaseTenants = await withOrgContext(session.organizationId, (tx) =>
    tx.leaseTenant.findMany({
      where: { contactId: user.contactId! },
      select: {
        lease: {
          select: {
            id: true,
            status: true,
            unitId: true,
            startDate: true,
            endDate: true,
            monthlyRentMinor: true,
            currency: true,
            securityDepositMinor: true,
            rentDueDay: true,
            unit: { select: { id: true, name: true } },
          },
        },
      },
    })
  );

  const activeLeases = leaseTenants
    .map((lt) => lt.lease)
    .filter((l) => l.status === "active" || l.status === "signed");

  if (activeLeases.length === 0) {
    return jsonResponse(
      { balance_due: 0, next_due_date: null, invoices: [], payments: [] },
      reqId
    );
  }

  const leaseIds = activeLeases.map((l) => l.id);

  // Get unpaid invoices
  const invoices = await withOrgContext(session.organizationId, (tx) =>
    tx.invoice.findMany({
      where: {
        organizationId: session.organizationId,
        leaseId: { in: leaseIds },
        status: { in: ["sent", "partially_paid", "overdue"] },
      },
      orderBy: { dueDate: "asc" },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        amountDueMinor: true,
        amountPaidMinor: true,
        dueDate: true,
        status: true,
        lease: { select: { unit: { select: { name: true } } } },
      },
    })
  );

  const balanceDue = invoices.reduce(
    (sum, inv) => sum + (inv.amountDueMinor - inv.amountPaidMinor),
    0
  );

  const nextDueDate = invoices.length > 0 ? invoices[0].dueDate : null;

  // Get recent payments
  const payments = await withOrgContext(session.organizationId, (tx) =>
    tx.payment.findMany({
      where: {
        organizationId: session.organizationId,
        leaseId: { in: leaseIds },
      },
      orderBy: { receivedAt: "desc" },
      take: 20,
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

  return jsonResponse(
    {
      balance_due: balanceDue,
      currency: activeLeases[0].currency,
      next_due_date: nextDueDate,
      invoices,
      payments,
    },
    reqId
  );
}
