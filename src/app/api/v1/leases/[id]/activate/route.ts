import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
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
  const session = await requireAuth(reqId, ["org_admin", "property_manager", "agent"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const existing = await prisma.lease.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Lease not found", reqId);
  }

  if (existing.status !== "draft") {
    return errorResponse(409, "invalid_transition", `Cannot activate a lease in '${existing.status}' status. Only draft leases can be activated.`, reqId);
  }

  const lease = await withOrgContext(session.organizationId, (tx) =>
    tx.lease.update({
      where: { id },
      data: { status: "active" },
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
    action: "leases.activate",
    entityTable: "leases",
    entityId: id,
    before: { status: existing.status },
    after: { status: lease.status },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(lease, reqId);
}
