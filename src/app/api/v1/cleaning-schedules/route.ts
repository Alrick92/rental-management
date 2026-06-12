import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createCleaningSchema, paginationSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid query parameters", reqId);
  }

  const statusFilter = url.searchParams.get("status");
  const unitId = url.searchParams.get("unit_id");
  const fromDate = url.searchParams.get("from_date");
  const toDate = url.searchParams.get("to_date");

  const where: Record<string, unknown> = {
    organizationId: session.organizationId,
  };
  if (statusFilter) where.status = statusFilter;
  if (unitId) where.unitId = unitId;
  if (fromDate || toDate) {
    const dateFilter: Record<string, Date> = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate);
    where.scheduledDate = dateFilter;
  }
  if (parsed.data.cursor) {
    where.id = { gt: parsed.data.cursor };
  }

  const data = await withOrgContext(session.organizationId, (tx) =>
    tx.cleaningSchedule.findMany({
      where,
      take: parsed.data.limit,
      orderBy: { scheduledDate: "asc" },
      include: {
        unit: { select: { id: true, name: true } },
        booking: { select: { id: true, checkIn: true, checkOut: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })
  );

  return jsonResponse(
    { data, next_cursor: data.length === parsed.data.limit ? data[data.length - 1]?.id : null },
    reqId
  );
}

export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = createCleaningSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const { unit_id, booking_id, scheduled_date, assigned_to_user_id, notes } = parsed.data;

  const unit = await prisma.unit.findFirst({
    where: { id: unit_id, organizationId: session.organizationId },
  });
  if (!unit) {
    return errorResponse(404, "not_found", "Unit not found", reqId);
  }

  if (booking_id) {
    const booking = await prisma.booking.findFirst({
      where: { id: booking_id, organizationId: session.organizationId },
    });
    if (!booking) {
      return errorResponse(404, "not_found", "Booking not found", reqId);
    }
  }

  if (assigned_to_user_id) {
    const assignee = await prisma.user.findFirst({
      where: { id: assigned_to_user_id, organizationId: session.organizationId },
    });
    if (!assignee) {
      return errorResponse(404, "not_found", "Assigned user not found in organization", reqId);
    }
  }

  const cleaning = await withOrgContext(session.organizationId, (tx) =>
    tx.cleaningSchedule.create({
      data: {
        organizationId: session.organizationId,
        unitId: unit_id,
        bookingId: booking_id,
        scheduledDate: new Date(scheduled_date),
        assignedToUserId: assigned_to_user_id,
        notes,
      },
      include: {
        unit: { select: { id: true, name: true } },
        booking: { select: { id: true, checkIn: true, checkOut: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "cleaning_schedules.create",
    entityTable: "cleaning_schedules",
    entityId: cleaning.id,
    after: { unitId: unit_id, scheduledDate: scheduled_date, status: "pending" },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(cleaning, reqId, 201);
}
