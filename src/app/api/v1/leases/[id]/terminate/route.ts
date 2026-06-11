import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { terminateLeaseSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  // Only org_admin can terminate leases
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = terminateLeaseSchema.safeParse(body);
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

  if (!["active", "signed"].includes(existing.status)) {
    return errorResponse(409, "invalid_transition", `Cannot terminate a lease in '${existing.status}' status`, reqId);
  }

  const lease = await withOrgContext(session.organizationId, (tx) =>
    tx.lease.update({
      where: { id },
      data: {
        status: "terminated",
        terminatedAt: new Date(),
        terminatedReason: parsed.data.reason,
      },
      include: {
        unit: { select: { id: true, name: true } },
        tenants: {
          include: { contact: { select: { id: true, name: true, email: true } } },
        },
      },
    })
  );

  // Cancel remaining draft invoices if it was signed
  if (existing.status === "signed") {
    await prisma.invoice.updateMany({
      where: { leaseId: id, status: { in: ["draft", "sent"] } },
      data: { status: "draft" },
    });
  }

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "leases.terminate",
    entityTable: "leases",
    entityId: id,
    before: { status: existing.status },
    after: { status: lease.status, terminatedAt: lease.terminatedAt, terminatedReason: lease.terminatedReason },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(lease, reqId);
}
