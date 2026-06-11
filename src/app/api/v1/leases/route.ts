import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createLeaseSchema, paginationSchema } from "@/lib/validators";
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

  const leases = await withOrgContext(session.organizationId, (tx) =>
    tx.lease.findMany({
      where: {
        organizationId: session.organizationId,
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(statusFilter ? { status: statusFilter as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        unit: { select: { id: true, name: true, unitKind: true } },
        tenants: {
          include: { contact: { select: { id: true, name: true, email: true } } },
        },
      },
    })
  );

  const hasMore = leases.length > limit;
  if (hasMore) leases.pop();

  return jsonResponse(
    {
      data: leases,
      next_cursor: hasMore ? leases[leases.length - 1].id : null,
    },
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

  const parsed = createLeaseSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  // Validate unit exists and belongs to org
  const unit = await prisma.unit.findFirst({
    where: { id: data.unit_id, organizationId: session.organizationId, status: "active" },
  });
  if (!unit) {
    return errorResponse(404, "unit_not_found", "Unit not found", reqId);
  }
  if (!unit.isRentable) {
    return errorResponse(409, "unit_not_rentable", "Unit is not rentable", reqId);
  }

  // Validate all tenant contacts exist
  const contacts = await prisma.contact.findMany({
    where: {
      id: { in: data.tenant_ids },
      organizationId: session.organizationId,
      deletedAt: null,
    },
  });
  if (contacts.length !== data.tenant_ids.length) {
    return errorResponse(404, "contact_not_found", "One or more tenant contacts not found", reqId);
  }

  // Check for overlapping leases on the same unit
  const overlapping = await prisma.lease.count({
    where: {
      unitId: data.unit_id,
      organizationId: session.organizationId,
      status: { in: ["active", "signed"] },
      startDate: { lt: new Date(data.end_date) },
      endDate: { gt: new Date(data.start_date) },
    },
  });
  if (overlapping > 0) {
    return errorResponse(409, "lease_collision", "Unit already has an active lease for the requested dates", reqId);
  }

  const lease = await withOrgContext(session.organizationId, (tx) =>
    tx.lease.create({
      data: {
        organizationId: session.organizationId,
        unitId: data.unit_id,
        startDate: new Date(data.start_date),
        endDate: new Date(data.end_date),
        monthlyRentMinor: data.monthly_rent_minor,
        currency: data.currency,
        securityDepositMinor: data.security_deposit_minor,
        rentDueDay: data.rent_due_day,
        tenants: {
          create: data.tenant_ids.map((contactId, i) => ({
            contactId,
            role: i === 0 ? ("primary" as const) : ("co_tenant" as const),
          })),
        },
      },
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
    action: "leases.create",
    entityTable: "leases",
    entityId: lease.id,
    after: lease,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(lease, reqId, 201);
}
