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
  const session = await requireAuth(reqId, ["org_admin", "property_manager"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const existing = await prisma.payment.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Payment not found", reqId);
  }
  if (existing.status !== "pending") {
    return errorResponse(409, "invalid_transition", `Payment is already '${existing.status}'`, reqId);
  }

  const payment = await withOrgContext(session.organizationId, (tx) =>
    tx.payment.update({
      where: { id },
      data: {
        status: "approved",
        approvedByUserId: session.userId,
        approvedAt: new Date(),
      },
      include: {
        contact: { select: { id: true, name: true } },
        recordedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "payments.approve",
    entityTable: "payments",
    entityId: id,
    before: { status: existing.status },
    after: { status: payment.status, approvedAt: payment.approvedAt },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(payment, reqId);
}
