import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

/**
 * POST /api/v1/disbursements/[id]/confirm
 *
 * Manager confirms a draft disbursement → status becomes `confirmed`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "property_manager"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const existing = await prisma.landlordPayment.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Disbursement not found", reqId);
  }
  if (existing.status !== "draft") {
    return errorResponse(
      409,
      "invalid_transition",
      `Disbursement is already '${existing.status}'`,
      reqId
    );
  }

  const disbursement = await withOrgContext(session.organizationId, (tx) =>
    tx.landlordPayment.update({
      where: { id },
      data: {
        status: "confirmed",
        confirmedAt: new Date(),
      },
      include: {
        property: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "disbursements.confirm",
    entityTable: "landlord_payments",
    entityId: id,
    before: { status: existing.status },
    after: { status: disbursement.status, confirmedAt: disbursement.confirmedAt },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(disbursement, reqId);
}
