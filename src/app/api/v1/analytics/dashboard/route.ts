import { withOrgContext } from "@/lib/db";
import {
  requestId,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

export async function GET(_request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "property_manager", "agent"]);
  if (session instanceof Response) return session;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    totalUnits,
    occupiedUnits,
    revenueThisMonth,
    revenueLastMonth,
    totalExpensesThisMonth,
    openTickets,
    pendingPayments,
    overdueInvoices,
    upcomingCheckIns,
    upcomingCheckOuts,
    recentPayments,
    recentAnnouncements,
  ] = await Promise.all([
    withOrgContext(session.organizationId, (tx) =>
      tx.unit.count({
        where: { organizationId: session.organizationId, isRentable: true },
      })
    ),
    withOrgContext(session.organizationId, async (tx) => {
      const distinctUnits = await tx.lease.findMany({
        where: {
          organizationId: session.organizationId,
          status: { in: ["active", "signed"] },
          startDate: { lte: now },
          endDate: { gte: now },
        },
        select: { unitId: true },
        distinct: ["unitId"],
      });
      return distinctUnits.length;
    }),
    withOrgContext(session.organizationId, (tx) =>
      tx.payment.aggregate({
        where: {
          organizationId: session.organizationId,
          status: "approved",
          receivedAt: { gte: thisMonthStart },
        },
        _sum: { amountMinor: true },
      })
    ),
    withOrgContext(session.organizationId, (tx) =>
      tx.payment.aggregate({
        where: {
          organizationId: session.organizationId,
          status: "approved",
          receivedAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { amountMinor: true },
      })
    ),
    withOrgContext(session.organizationId, (tx) =>
      tx.expense.aggregate({
        where: {
          organizationId: session.organizationId,
          expenseDate: { gte: thisMonthStart },
        },
        _sum: { amountMinor: true },
      })
    ),
    withOrgContext(session.organizationId, (tx) =>
      tx.maintenanceTicket.count({
        where: {
          organizationId: session.organizationId,
          status: { in: ["open", "in_progress"] },
        },
      })
    ),
    withOrgContext(session.organizationId, (tx) =>
      tx.payment.count({
        where: {
          organizationId: session.organizationId,
          status: "pending",
        },
      })
    ),
    withOrgContext(session.organizationId, (tx) =>
      tx.invoice.count({
        where: {
          organizationId: session.organizationId,
          status: "overdue",
        },
      })
    ),
    withOrgContext(session.organizationId, (tx) =>
      tx.booking.findMany({
        where: {
          organizationId: session.organizationId,
          status: "confirmed",
          checkIn: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        },
        include: {
          unit: { select: { id: true, name: true } },
          primaryContact: { select: { name: true } },
        },
        orderBy: { checkIn: "asc" },
        take: 5,
      })
    ),
    withOrgContext(session.organizationId, (tx) =>
      tx.booking.findMany({
        where: {
          organizationId: session.organizationId,
          status: "checked_in",
          checkOut: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        },
        include: {
          unit: { select: { id: true, name: true } },
          primaryContact: { select: { name: true } },
        },
        orderBy: { checkOut: "asc" },
        take: 5,
      })
    ),
    withOrgContext(session.organizationId, (tx) =>
      tx.payment.findMany({
        where: {
          organizationId: session.organizationId,
          status: "pending",
        },
        include: {
          contact: { select: { name: true } },
        },
        orderBy: { receivedAt: "desc" },
        take: 5,
      })
    ),
    withOrgContext(session.organizationId, (tx) =>
      tx.announcement.findMany({
        where: {
          organizationId: session.organizationId,
          publishedAt: { not: null },
        },
        orderBy: { publishedAt: "desc" },
        take: 3,
        select: { id: true, title: true, scope: true, publishedAt: true },
      })
    ),
  ]);

  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 1000) / 10 : 0;

  return jsonResponse(
    {
      occupancy: {
        total: totalUnits,
        occupied: occupiedUnits,
        rate: occupancyRate,
      },
      revenue: {
        thisMonth: revenueThisMonth._sum.amountMinor ?? 0,
        lastMonth: revenueLastMonth._sum.amountMinor ?? 0,
      },
      expenses: {
        thisMonth: totalExpensesThisMonth._sum.amountMinor ?? 0,
      },
      tickets: {
        open: openTickets,
      },
      payments: {
        pending: pendingPayments,
        recentPending: recentPayments.map((p) => ({
          id: p.id,
          amount: p.amountMinor,
          currency: p.currency,
          contact: p.contact?.name ?? "Unknown",
          date: p.receivedAt,
        })),
      },
      invoices: {
        overdue: overdueInvoices,
      },
      upcomingCheckIns: upcomingCheckIns.map((b) => ({
        id: b.id,
        unit: b.unit.name,
        guest: b.primaryContact.name,
        date: b.checkIn,
      })),
      upcomingCheckOuts: upcomingCheckOuts.map((b) => ({
        id: b.id,
        unit: b.unit.name,
        guest: b.primaryContact.name,
        date: b.checkOut,
      })),
      announcements: recentAnnouncements,
    },
    reqId
  );
}
