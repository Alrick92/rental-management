import { prisma, withOrgContext } from "@/lib/db";
import {
  requestId,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

/**
 * GET /api/v1/gdpr/requests
 *
 * List GDPR requests for the current org. Org_admin only.
 */
export async function GET(_request: Request) {
  const reqId = requestId();
  const auth = await requireAuth(reqId, ["org_admin"]);
  if (auth instanceof Response) return auth;

  const requests = await withOrgContext(auth.organizationId, () =>
    prisma.gdprRequest.findMany({
      where: { organizationId: auth.organizationId },
      include: {
        contact: { select: { id: true, name: true, email: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  );

  return jsonResponse(
    {
      data: requests.map((r) => ({
        id: r.id,
        contact: r.contact,
        request_type: r.requestType,
        status: r.status,
        requested_by: r.requestedBy,
        notes: r.notes,
        completed_at: r.completedAt?.toISOString() || null,
        created_at: r.createdAt.toISOString(),
      })),
    },
    reqId
  );
}
