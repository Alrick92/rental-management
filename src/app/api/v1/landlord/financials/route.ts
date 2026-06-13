import { withOrgContext } from "@/lib/db";
import {
  requestId,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

/**
 * GET /api/v1/landlord/financials
 *
 * Returns financial data for properties owned by the logged-in landlord:
 * income, expenses, disbursements, ROI per property.
 */
export async function GET() {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["landlord"]);
  if (session instanceof Response) return session;

  const orgId = session.organizationId;

  // Find landlord's contact
  const user = await withOrgContext(orgId, (tx) =>
    tx.user.findUnique({
      where: { id: session.userId },
      select: { contactId: true },
    })
  );

  if (!user?.contactId) {
    return jsonResponse({ properties: [], disbursements: [] }, reqId);
  }

  // Find properties this landlord owns
  const ownerships = await withOrgContext(orgId, (tx) =>
    tx.propertyOwner.findMany({
      where: { contactId: user.contactId! },
      include: {
        property: {
          include: {
            units: {
              select: {
                id: true,
                name: true,
                leases: {
                  where: { status: { in: ["active", "signed"] } },
                  select: { id: true, monthlyRentMinor: true },
                },
              },
            },
          },
        },
      },
    })
  );

  const propertyIds = ownerships.map((o) => o.propertyId);
  const unitIds = ownerships.flatMap((o) => o.property.units.map((u) => u.id));

  // Get approved payments on leases for these units
  const payments = await withOrgContext(orgId, (tx) =>
    tx.payment.findMany({
      where: {
        organizationId: orgId,
        status: "approved",
        lease: { unitId: { in: unitIds } },
      },
      select: {
        amountMinor: true,
        receivedAt: true,
        lease: { select: { unitId: true } },
      },
    })
  );

  // Get expenses for these properties
  const expenses = await withOrgContext(orgId, (tx) =>
    tx.expense.findMany({
      where: {
        organizationId: orgId,
        propertyId: { in: propertyIds },
      },
      select: { amountMinor: true, propertyId: true, expenseDate: true },
    })
  );

  // Get disbursements
  const disbursements = await withOrgContext(orgId, (tx) =>
    tx.landlordPayment.findMany({
      where: {
        organizationId: orgId,
        contactId: user.contactId!,
      },
      orderBy: { periodStart: "desc" },
      include: {
        property: { select: { id: true, name: true } },
      },
    })
  );

  // Build unit-to-property map
  const unitToProperty = new Map<string, string>();
  for (const ownership of ownerships) {
    for (const unit of ownership.property.units) {
      unitToProperty.set(unit.id, ownership.propertyId);
    }
  }

  // Aggregate per property
  const propertyData = ownerships.map((ownership) => {
    const prop = ownership.property;
    const propUnitIds = prop.units.map((u) => u.id);

    const totalIncome = payments
      .filter((p) => p.lease?.unitId && propUnitIds.includes(p.lease.unitId))
      .reduce((sum, p) => sum + p.amountMinor, 0);

    const totalExpenses = expenses
      .filter((e) => e.propertyId === prop.id)
      .reduce((sum, e) => sum + e.amountMinor, 0);

    const monthlyRent = prop.units.reduce(
      (sum, u) => sum + (u.leases[0]?.monthlyRentMinor ?? 0),
      0
    );

    return {
      id: prop.id,
      name: prop.name,
      ownershipShare: ownership.share,
      totalUnits: prop.units.length,
      occupiedUnits: prop.units.filter((u) => u.leases.length > 0).length,
      monthlyRent,
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses,
    };
  });

  return jsonResponse(
    {
      properties: propertyData,
      disbursements: disbursements.map((d) => ({
        id: d.id,
        property: d.property,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        rentCollectedMinor: d.rentCollectedMinor,
        expensesMinor: d.expensesMinor,
        managementFeeMinor: d.managementFeeMinor,
        netPayoutMinor: d.netPayoutMinor,
        currency: d.currency,
        status: d.status,
        confirmedAt: d.confirmedAt,
      })),
    },
    reqId
  );
}
