import { prisma, withOrgContext } from "@/lib/db";
import { availabilityQuerySchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const { id } = await params;
  const url = new URL(request.url);

  const parsed = availabilityQuerySchema.safeParse({
    start_date: url.searchParams.get("start_date"),
    end_date: url.searchParams.get("end_date"),
  });
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "start_date and end_date are required (YYYY-MM-DD)", reqId, {
      issues: parsed.error.issues,
    });
  }

  const startDate = new Date(parsed.data.start_date);
  const endDate = new Date(parsed.data.end_date);

  if (endDate <= startDate) {
    return errorResponse(400, "invalid_dates", "end_date must be after start_date", reqId);
  }

  const unit = await prisma.unit.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, name: true, rentalType: true },
  });
  if (!unit) {
    return errorResponse(404, "not_found", "Unit not found", reqId);
  }

  // Find overlapping confirmed bookings
  const bookings = await withOrgContext(session.organizationId, (tx) =>
    tx.booking.findMany({
      where: {
        unitId: id,
        organizationId: session.organizationId,
        status: { in: ["confirmed", "checked_in"] },
        checkIn: { lt: endDate },
        checkOut: { gt: startDate },
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        status: true,
        primaryContact: { select: { id: true, name: true } },
      },
      orderBy: { checkIn: "asc" },
    })
  );

  // Find overlapping active leases
  const leases = await withOrgContext(session.organizationId, (tx) =>
    tx.lease.findMany({
      where: {
        unitId: id,
        organizationId: session.organizationId,
        status: { in: ["active", "signed"] },
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
      },
      orderBy: { startDate: "asc" },
    })
  );

  // Find blocked dates
  const blockedDates = await withOrgContext(session.organizationId, (tx) =>
    tx.unitBlockedDate.findMany({
      where: {
        unitId: id,
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        reason: true,
        notes: true,
      },
      orderBy: { startDate: "asc" },
    })
  );

  // Build day-by-day availability map
  const days: Array<{ date: string; available: boolean; reason?: string }> = [];
  const current = new Date(startDate);
  while (current < endDate) {
    const dateStr = current.toISOString().split("T")[0];
    let available = true;
    let reason: string | undefined;

    for (const b of bookings) {
      const bStart = new Date(b.checkIn);
      const bEnd = new Date(b.checkOut);
      if (current >= bStart && current < bEnd) {
        available = false;
        reason = "booked";
        break;
      }
    }

    if (available) {
      for (const l of leases) {
        const lStart = new Date(l.startDate);
        const lEnd = new Date(l.endDate);
        if (current >= lStart && current < lEnd) {
          available = false;
          reason = "leased";
          break;
        }
      }
    }

    if (available) {
      for (const bd of blockedDates) {
        const bdStart = new Date(bd.startDate);
        const bdEnd = new Date(bd.endDate);
        if (current >= bdStart && current < bdEnd) {
          available = false;
          reason = "blocked";
          break;
        }
      }
    }

    days.push({ date: dateStr, available, ...(reason ? { reason } : {}) });
    current.setDate(current.getDate() + 1);
  }

  const availableDays = days.filter((d) => d.available).length;

  return jsonResponse({
    unit,
    range: { start_date: parsed.data.start_date, end_date: parsed.data.end_date },
    summary: {
      total_days: days.length,
      available_days: availableDays,
      occupied_days: days.length - availableDays,
    },
    bookings,
    leases,
    blocked_dates: blockedDates,
    days,
  }, reqId);
}
