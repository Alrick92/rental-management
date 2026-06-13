import { readFile } from "fs/promises";
import { join } from "path";
import { withOrgContext } from "@/lib/db";
import {
  requestId,
  errorResponse,
  requireAuth,
} from "@/lib/api-utils";

const UPLOAD_DIR = join(process.cwd(), "uploads");

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
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

  const filePath = join(UPLOAD_DIR, doc.storageKey);

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(filePath);
  } catch {
    return errorResponse(404, "file_missing", "File not found on disk", reqId);
  }

  const ab = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  ) as ArrayBuffer;

  return new Response(ab, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename="${doc.originalFilename.replace(/[\\"]/g, '_')}"`,
      "Content-Length": String(fileBuffer.length),
      "X-Request-Id": reqId,
    },
  });
}
