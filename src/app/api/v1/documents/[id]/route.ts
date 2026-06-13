import { withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, [
    "org_admin",
    "property_manager",
    "agent",
  ]);
  if (session instanceof Response) return session;

  const { id } = await context.params;

  const doc = await withOrgContext(session.organizationId, (tx) =>
    tx.document.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
        deletedAt: null,
      },
    })
  );

  if (!doc) {
    return errorResponse(404, "not_found", "Document not found", reqId);
  }

  await withOrgContext(session.organizationId, (tx) =>
    tx.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "documents.delete",
    entityTable: "documents",
    entityId: id,
    before: { original_filename: doc.originalFilename },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse({ deleted: true }, reqId);
}
