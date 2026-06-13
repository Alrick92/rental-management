import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createBookingSchema, paginationSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid pagination params", reqId, {
      issues: parsed.error.issues,
    });
  }
  const { cursor, limit } = parsed.data;
  const statusFilter = url.searchParams.get("status");
  const unitFilter = url.searchParams.get("unit_id");

  const bookings = await withOrgContext(session.organizationId, (tx) =>
    tx.booking.findMany({
      where: {
        organizationId: session.organizationId,
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(statusFilter ? { status: statusFilter as never } : {}),
        ...(unitFilter ? { unitId: unitFilter } : {}),
      },
      orderBy: { checkIn: "desc" },
      take: limit + 1,
      include: {
        unit: { select: { id: true, name: true, unitKind: true } },
        primaryContact: { select: { id: true, name: true, email: true, phone: true } },
      },
    })
  );

  const hasMore = bookings.length > limit;
  if (hasMore) bookings.pop();

  return jsonResponse(
    {
      data: bookings,
      next_cursor: hasMore ? bookings[bookings.length - 1].id : null,
    },
    reqId
  );
}

export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "property_manager", "agent"]);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  // Validate unit
  const unit = await prisma.unit.findFirst({
    where: { id: data.unit_id, organizationId: session.organizationId, status: "active" },
  });
  if (!unit) {
    return errorResponse(404, "unit_not_found", "Unit not found", reqId);
  }
  if (!unit.isRentable) {
    return errorResponse(409, "unit_not_rentable", "Unit is not rentable", reqId);
  }

  // Validate contact
  const contact = await prisma.contact.findFirst({
    where: { id: data.primary_contact_id, organizationId: session.organizationId, deletedAt: null },
  });
  if (!contact) {
    return errorResponse(404, "contact_not_found", "Primary contact not found", reqId);
  }

  // Check for overlapping confirmed/checked-in bookings
  const overlapping = await prisma.booking.count({
    where: {
      unitId: data.unit_id,
      organizationId: session.organizationId,
      status: { in: ["confirmed", "checked_in"] },
      checkIn: { lt: new Date(data.check_out) },
      checkOut: { gt: new Date(data.check_in) },
    },
  });
  if (overlapping > 0) {
    return errorResponse(409, "booking_collision", "Unit already has a confirmed booking for the requested dates", reqId);
  }

  // Check for active leases covering the period
  const leaseOverlap = await prisma.lease.count({
    where: {
      unitId: data.unit_id,
      organizationId: session.organizationId,
      status: { in: ["active", "signed"] },
      startDate: { lt: new Date(data.check_out) },
      endDate: { gt: new Date(data.check_in) },
    },
  });
  if (leaseOverlap > 0) {
    return errorResponse(409, "lease_blocks_booking", "Unit has an active lease for the requested dates", reqId);
  }

  // Handle idempotency key
  const idempotencyKey = request.headers.get("idempotency-key") ?? null;
  if (idempotencyKey) {
    const existingBooking = await prisma.booking.findFirst({
      where: {
        organizationId: session.organizationId,
        idempotencyKey,
      },
      include: {
        unit: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, name: true, email: true } },
      },
    });
    if (existingBooking) {
      return jsonResponse(existingBooking, reqId, 200);
    }
  }

  const booking = await withOrgContext(session.organizationId, (tx) =>
    tx.booking.create({
      data: {
        organizationId: session.organizationId,
        unitId: data.unit_id,
        checkIn: new Date(data.check_in),
        checkOut: new Date(data.check_out),
        nightlyRateMinor: data.nightly_rate_minor,
        totalAmountMinor: data.total_amount_minor,
        currency: data.currency,
        primaryContactId: data.primary_contact_id,
        channel: data.channel,
        idempotencyKey,
        notes: data.notes ?? null,
      },
      include: {
        unit: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, name: true, email: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "bookings.create",
    entityTable: "bookings",
    entityId: booking.id,
    after: booking,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(booking, reqId, 201);
}
