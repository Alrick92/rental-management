import { withOrgContext } from "@/lib/db";
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

  const announcement = await withOrgContext(session.organizationId, (tx) =>
    tx.announcement.findFirst({
      where: { id, organizationId: session.organizationId },
    })
  );

  if (!announcement) {
    return errorResponse(404, "not_found", "Announcement not found", reqId);
  }

  if (announcement.publishedAt) {
    return errorResponse(400, "already_published", "Announcement is already published", reqId);
  }

  const updated = await withOrgContext(session.organizationId, (tx) =>
    tx.announcement.update({
      where: { id },
      data: { publishedAt: new Date() },
      include: {
        createdBy: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "announcements.publish",
    entityTable: "announcements",
    entityId: id,
    before: { publishedAt: null },
    after: { publishedAt: updated.publishedAt },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(updated, reqId);
}
