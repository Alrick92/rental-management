import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { readFile, deleteFile } from "@/lib/storage";
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
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const { id } = await params;
  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "true";

  const document = await withOrgContext(session.organizationId, (tx) =>
    tx.document.findFirst({
      where: { id, organizationId: session.organizationId, deletedAt: null },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    })
  );

  if (!document) {
    return errorResponse(404, "not_found", "Document not found", reqId);
  }

  if (download) {
    try {
      const buffer = await readFile(document.storageKey);
      const disposition = `attachment; filename="${encodeURIComponent(document.originalFilename)}"`;
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": document.mimeType,
          "Content-Disposition": disposition,
          "Content-Length": buffer.length.toString(),
          "X-Request-Id": reqId,
        },
      });
    } catch {
      return errorResponse(500, "file_not_found", "File storage error", reqId);
    }
  }

  return jsonResponse(document, reqId);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const { id } = await params;

  const existing = await prisma.document.findFirst({
    where: { id, organizationId: session.organizationId, deletedAt: null },
  });
  if (!existing) {
    return errorResponse(404, "not_found", "Document not found", reqId);
  }

  // Soft-delete the document record
  await withOrgContext(session.organizationId, (tx) =>
    tx.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  );

  // Delete the physical file
  await deleteFile(existing.storageKey);

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "documents.delete",
    entityTable: "documents",
    entityId: id,
    before: { originalFilename: existing.originalFilename, ownerTable: existing.ownerTable, ownerId: existing.ownerId },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse({ deleted: true }, reqId);
}
