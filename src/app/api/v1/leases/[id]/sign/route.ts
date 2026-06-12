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
  // Only org_admin can sign leases
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const existing = await prisma.lease.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Lease not found", reqId);
  }

  if (existing.status !== "active") {
    return errorResponse(409, "invalid_transition", `Cannot sign a lease in '${existing.status}' status. Only active leases can be signed.`, reqId);
  }

  const lease = await withOrgContext(session.organizationId, (tx) =>
    tx.lease.update({
      where: { id },
      data: {
        status: "signed",
        signedAt: new Date(),
        signedByUserId: session.userId,
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
    action: "leases.sign",
    entityTable: "leases",
    entityId: id,
    before: { status: existing.status },
    after: { status: lease.status, signedAt: lease.signedAt },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(lease, reqId);
}
