import { prisma, withOrgContext } from "@/lib/db";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

/**
 * GET /api/v1/search?q=<query>&type=<optional entity type>
 *
 * Global search across contacts, properties, units, leases, bookings.
 * Org-scoped. Available to org_admin, property_manager, agent.
 */
export async function GET(request: Request) {
  const reqId = requestId();
  const auth = await requireAuth(reqId, [
    "org_admin",
    "property_manager",
    "agent",
  ]);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const entityType = url.searchParams.get("type") || undefined;
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "10", 10), 1),
    50
  );

  if (!query || query.length < 2) {
    return errorResponse(
      400,
      "query_too_short",
      "Search query must be at least 2 characters",
      reqId
    );
  }

  const results: Array<{
    entity_type: string;
    id: string;
    title: string;
    subtitle: string | null;
    url: string;
  }> = [];

  const searchContacts =
    !entityType || entityType === "contacts";
  const searchProperties =
    !entityType || entityType === "properties";
  const searchUnits =
    !entityType || entityType === "units";
  const searchLeases =
    !entityType || entityType === "leases";
  const searchBookings =
    !entityType || entityType === "bookings";

  const orgId = auth.organizationId;

  if (searchContacts) {
    const contacts = await withOrgContext(orgId, () =>
      prisma.contact.findMany({
        where: {
          organizationId: orgId,
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, email: true },
        take: limit,
      })
    );
    for (const c of contacts) {
      results.push({
        entity_type: "contact",
        id: c.id,
        title: c.name,
        subtitle: c.email,
        url: `/dashboard/contacts?id=${c.id}`,
      });
    }
  }

  if (searchProperties) {
    const properties = await withOrgContext(orgId, () =>
      prisma.property.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { city: { contains: query, mode: "insensitive" } },
            { addressLine1: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, city: true, region: true },
        take: limit,
      })
    );
    for (const p of properties) {
      results.push({
        entity_type: "property",
        id: p.id,
        title: p.name,
        subtitle: [p.city, p.region].filter(Boolean).join(", ") || null,
        url: `/dashboard/properties?id=${p.id}`,
      });
    }
  }

  if (searchUnits) {
    const units = await withOrgContext(orgId, () =>
      prisma.unit.findMany({
        where: {
          organizationId: orgId,
          OR: [{ name: { contains: query, mode: "insensitive" } }],
        },
        select: { id: true, name: true, unitKind: true },
        take: limit,
      })
    );
    for (const u of units) {
      results.push({
        entity_type: "unit",
        id: u.id,
        title: u.name,
        subtitle: u.unitKind,
        url: `/dashboard/units?id=${u.id}`,
      });
    }
  }

  if (searchLeases) {
    const leases = await withOrgContext(orgId, () =>
      prisma.lease.findMany({
        where: {
          organizationId: orgId,
          unit: { name: { contains: query, mode: "insensitive" } },
        },
        include: {
          unit: { select: { name: true } },
          tenants: {
            where: { role: "primary" },
            include: { contact: { select: { name: true } } },
            take: 1,
          },
        },
        take: limit,
      })
    );
    for (const l of leases) {
      const tenant = l.tenants[0]?.contact?.name || "Unknown";
      results.push({
        entity_type: "lease",
        id: l.id,
        title: `${l.unit.name} — ${tenant}`,
        subtitle: `${l.status} (${l.startDate.toLocaleDateString()})`,
        url: `/dashboard/leases?id=${l.id}`,
      });
    }
  }

  if (searchBookings) {
    const bookings = await withOrgContext(orgId, () =>
      prisma.booking.findMany({
        where: {
          organizationId: orgId,
          OR: [
            {
              unit: { name: { contains: query, mode: "insensitive" } },
            },
            {
              primaryContact: {
                name: { contains: query, mode: "insensitive" },
              },
            },
          ],
        },
        include: {
          unit: { select: { name: true } },
          primaryContact: { select: { name: true } },
        },
        take: limit,
      })
    );
    for (const b of bookings) {
      results.push({
        entity_type: "booking",
        id: b.id,
        title: `${b.unit.name} — ${b.primaryContact.name}`,
        subtitle: `${b.status} (${b.checkIn.toLocaleDateString()})`,
        url: `/dashboard/bookings?id=${b.id}`,
      });
    }
  }

  return jsonResponse(
    {
      query,
      total: results.length,
      results: results.slice(0, limit),
    },
    reqId
  );
}
