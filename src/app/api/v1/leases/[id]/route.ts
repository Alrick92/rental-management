import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { updateLeaseSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
  if (session instanceof Response) return session;

  const { id } = await params;

  const lease = await withOrgContext(session.organizationId, (tx) =>
    tx.lease.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        unit: { select: { id: true, name: true, unitKind: true, addressLine1: true, city: true } },
        tenants: {
          include: { contact: { select: { id: true, name: true, email: true, phone: true } } },
        },
        payments: {
          select: { id: true, amountMinor: true, currency: true, method: true, receivedAt: true },
          orderBy: { receivedAt: "desc" },
          take: 20,
        },
      },
    })
  );

  if (!lease) {
    return errorResponse(404, "not_found", "Lease not found", reqId);
  }

  return jsonResponse(lease, reqId);
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

  const parsed = updateLeaseSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.lease.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Lease not found", reqId);
  }

  // Signed leases are immutable for key fields
  if (existing.status === "signed") {
    return errorResponse(409, "lease_signed_immutable", "Signed leases cannot be modified. Create a new lease instead.", reqId);
  }
  if (existing.status === "ended" || existing.status === "terminated" || existing.status === "cancelled") {
    return errorResponse(409, "lease_closed", "Cannot modify a closed lease", reqId);
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (data.start_date !== undefined) updateData.startDate = new Date(data.start_date);
  if (data.end_date !== undefined) updateData.endDate = new Date(data.end_date);
  if (data.monthly_rent_minor !== undefined) updateData.monthlyRentMinor = data.monthly_rent_minor;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.security_deposit_minor !== undefined) updateData.securityDepositMinor = data.security_deposit_minor;
  if (data.rent_due_day !== undefined) updateData.rentDueDay = data.rent_due_day;

  const lease = await withOrgContext(session.organizationId, (tx) =>
    tx.lease.update({
      where: { id },
      data: updateData,
      include: {
        unit: { select: { id: true, name: true } },
        tenants: {
          include: { contact: { select: { id: true, name: true, email: true } } },
        },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "leases.update",
    entityTable: "leases",
    entityId: lease.id,
    before: existing,
    after: lease,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(lease, reqId);
}
