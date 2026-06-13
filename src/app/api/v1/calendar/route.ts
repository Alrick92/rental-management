import { withOrgContext } from "@/lib/db";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "property_manager", "agent"]);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const startStr = url.searchParams.get("start");
  const endStr = url.searchParams.get("end");

  if (!startStr || !endStr) {
    return errorResponse(400, "missing_params", "start and end query params required (YYYY-MM-DD)", reqId);
  }

  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return errorResponse(400, "invalid_dates", "Invalid date format", reqId);
  }

  const [bookings, leases] = await Promise.all([
    withOrgContext(session.organizationId, (tx) =>
      tx.booking.findMany({
        where: {
          organizationId: session.organizationId,
          status: { not: "cancelled" },
          checkIn: { lte: end },
          checkOut: { gte: start },
        },
        include: {
          unit: { select: { id: true, name: true, propertyId: true } },
          primaryContact: { select: { id: true, name: true } },
        },
        orderBy: { checkIn: "asc" },
      })
    ),
    withOrgContext(session.organizationId, (tx) =>
      tx.lease.findMany({
        where: {
          organizationId: session.organizationId,
          status: { in: ["active", "signed"] },
          startDate: { lte: end },
          endDate: { gte: start },
        },
        include: {
          unit: { select: { id: true, name: true, propertyId: true } },
          tenants: {
            include: { contact: { select: { id: true, name: true } } },
            where: { role: "primary" },
            take: 1,
          },
        },
        orderBy: { startDate: "asc" },
      })
    ),
  ]);

  const events = [
    ...bookings.map((b) => ({
      id: b.id,
      type: "booking" as const,
      unitId: b.unit.id,
      unitName: b.unit.name,
      propertyId: b.unit.propertyId,
      start: b.checkIn,
      end: b.checkOut,
      status: b.status,
      guest: b.primaryContact.name,
      totalMinor: b.totalAmountMinor,
      currency: b.currency,
    })),
    ...leases.map((l) => ({
      id: l.id,
      type: "lease" as const,
      unitId: l.unit.id,
      unitName: l.unit.name,
      propertyId: l.unit.propertyId,
      start: l.startDate,
      end: l.endDate,
      status: l.status,
      tenant: l.tenants[0]?.contact.name ?? "Unknown",
      monthlyRentMinor: l.monthlyRentMinor,
      currency: l.currency,
    })),
  ];

  return jsonResponse({ data: events }, reqId);
}
