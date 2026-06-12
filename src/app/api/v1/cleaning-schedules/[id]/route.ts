import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { updateCleaningSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const cleaning = await withOrgContext(session.organizationId, (tx) =>
    tx.cleaningSchedule.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        unit: { select: { id: true, name: true } },
        booking: { select: { id: true, checkIn: true, checkOut: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })
  );

  if (!cleaning) {
    return errorResponse(404, "not_found", "Cleaning schedule not found", reqId);
  }

  return jsonResponse(cleaning, reqId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = updateCleaningSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.cleaningSchedule.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Cleaning schedule not found", reqId);
  }

  if (existing.status === "done" && parsed.data.status !== "done") {
    return errorResponse(409, "already_done", "Cannot modify a completed cleaning", reqId);
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.scheduled_date !== undefined) data.scheduledDate = new Date(parsed.data.scheduled_date);
  if (parsed.data.assigned_to_user_id !== undefined) {
    if (parsed.data.assigned_to_user_id === null) {
      data.assignedToUserId = null;
    } else {
      const assignee = await prisma.user.findFirst({
        where: { id: parsed.data.assigned_to_user_id, organizationId: session.organizationId },
      });
      if (!assignee) {
        return errorResponse(404, "not_found", "Assigned user not found in organization", reqId);
      }
      data.assignedToUserId = parsed.data.assigned_to_user_id;
    }
  }
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  const cleaning = await withOrgContext(session.organizationId, (tx) =>
    tx.cleaningSchedule.update({
      where: { id },
      data,
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
    action: "cleaning_schedules.update",
    entityTable: "cleaning_schedules",
    entityId: id,
    before: { status: existing.status, scheduledDate: existing.scheduledDate },
    after: { status: cleaning.status, scheduledDate: cleaning.scheduledDate },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(cleaning, reqId);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const existing = await prisma.cleaningSchedule.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Cleaning schedule not found", reqId);
  }

  await withOrgContext(session.organizationId, (tx) =>
    tx.cleaningSchedule.delete({ where: { id } })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "cleaning_schedules.delete",
    entityTable: "cleaning_schedules",
    entityId: id,
    before: { unitId: existing.unitId, scheduledDate: existing.scheduledDate, status: existing.status },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse({ deleted: true }, reqId);
}
