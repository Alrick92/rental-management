import { withOrgContext } from "@/lib/db";
import {
  requestId,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

/**
 * GET /api/v1/reports/financial-summary
 *
 * Org-wide financial summary: revenue, expenses, net income,
 * occupancy, and outstanding balances per property.
 */
export async function GET() {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "property_manager"]);
  if (session instanceof Response) return session;

  const orgId = session.organizationId;

  // Get all properties with units
  const properties = await withOrgContext(orgId, (tx) =>
    tx.property.findMany({
      where: { organizationId: orgId },
      include: {
        units: {
          select: {
            id: true,
            leases: {
              where: { status: { in: ["active", "signed"] } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    })
  );

  // Get all approved payments
  const payments = await withOrgContext(orgId, (tx) =>
    tx.payment.findMany({
      where: { organizationId: orgId, status: "approved" },
      select: {
        amountMinor: true,
        lease: { select: { unitId: true } },
      },
    })
  );

  // Get all expenses
  const expenses = await withOrgContext(orgId, (tx) =>
    tx.expense.findMany({
      where: { organizationId: orgId },
      select: { amountMinor: true, propertyId: true },
    })
  );

  // Get unpaid invoices for outstanding balance
  const unpaidInvoices = await withOrgContext(orgId, (tx) =>
    tx.invoice.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["sent", "partially_paid", "overdue"] },
      },
      select: {
        amountDueMinor: true,
        amountPaidMinor: true,
        lease: { select: { unitId: true } },
      },
    })
  );

  // Build unit-to-property map
  const unitToProperty = new Map<string, string>();
  for (const prop of properties) {
    for (const unit of prop.units) {
      unitToProperty.set(unit.id, prop.id);
    }
  }

  // Aggregate per property
  const propMap = new Map<string, {
    id: string;
    name: string;
    totalUnits: number;
    occupiedUnits: number;
    revenue: number;
    expenses: number;
    outstandingBalance: number;
  }>();

  for (const prop of properties) {
    const occupied = prop.units.filter((u) => u.leases.length > 0).length;
    propMap.set(prop.id, {
      id: prop.id,
      name: prop.name,
      totalUnits: prop.units.length,
      occupiedUnits: occupied,
      revenue: 0,
      expenses: 0,
      outstandingBalance: 0,
    });
  }

  for (const payment of payments) {
    if (payment.lease?.unitId) {
      const propId = unitToProperty.get(payment.lease.unitId);
      if (propId) {
        const entry = propMap.get(propId);
        if (entry) entry.revenue += payment.amountMinor;
      }
    }
  }

  for (const expense of expenses) {
    if (expense.propertyId) {
      const entry = propMap.get(expense.propertyId);
      if (entry) entry.expenses += expense.amountMinor;
    }
  }

  for (const inv of unpaidInvoices) {
    if (inv.lease?.unitId) {
      const propId = unitToProperty.get(inv.lease.unitId);
      if (propId) {
        const entry = propMap.get(propId);
        if (entry) entry.outstandingBalance += inv.amountDueMinor - inv.amountPaidMinor;
      }
    }
  }

  const propertySummaries = Array.from(propMap.values()).map((p) => ({
    ...p,
    netIncome: p.revenue - p.expenses,
  }));

  const totalRevenue = propertySummaries.reduce((s, p) => s + p.revenue, 0);
  const totalExpenses = propertySummaries.reduce((s, p) => s + p.expenses, 0);
  const totalUnits = propertySummaries.reduce((s, p) => s + p.totalUnits, 0);
  const occupiedUnits = propertySummaries.reduce((s, p) => s + p.occupiedUnits, 0);
  const totalOutstanding = propertySummaries.reduce((s, p) => s + p.outstandingBalance, 0);

  return jsonResponse(
    {
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      totalUnits,
      occupiedUnits,
      occupancyRate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0,
      totalOutstanding,
      properties: propertySummaries,
    },
    reqId
  );
}
