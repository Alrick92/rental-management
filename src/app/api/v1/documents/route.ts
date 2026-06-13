import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";
import { documentQuerySchema } from "@/lib/validators";

const UPLOAD_DIR = join(process.cwd(), "uploads");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parsed = documentQuerySchema.safeParse({
    owner_table: url.searchParams.get("owner_table") ?? undefined,
    owner_id: url.searchParams.get("owner_id") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid query params", reqId, {
      issues: parsed.error.issues,
    });
  }
  const { owner_table: ownerTable, owner_id: ownerId } = parsed.data;

  const documents = await withOrgContext(session.organizationId, (tx) =>
    tx.document.findMany({
      where: {
        organizationId: session.organizationId,
        ownerTable,
        ownerId,
        deletedAt: null,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  );

  return jsonResponse({ data: documents }, reqId);
}

export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, [
    "org_admin",
    "property_manager",
    "agent",
  ]);
  if (session instanceof Response) return session;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, "invalid_form", "Expected multipart form data", reqId);
  }

  const file = formData.get("file") as File | null;
  const ownerTable = formData.get("owner_table") as string | null;
  const ownerId = formData.get("owner_id") as string | null;

  if (!file || !ownerTable || !ownerId) {
    return errorResponse(
      400,
      "missing_fields",
      "file, owner_table, and owner_id are required",
      reqId
    );
  }

  const allowedTables = ["properties", "leases", "contacts", "maintenance_tickets"];
  if (!allowedTables.includes(ownerTable)) {
    return errorResponse(400, "invalid_owner_table", "Invalid owner_table", reqId);
  }

  if (!UUID_RE.test(ownerId)) {
    return errorResponse(400, "invalid_owner_id", "owner_id must be a valid UUID", reqId);
  }

  const maxSize = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSize) {
    return errorResponse(400, "file_too_large", "File exceeds 10 MB limit", reqId);
  }

  const orgDir = join(UPLOAD_DIR, session.organizationId);
  await mkdir(orgDir, { recursive: true });

  const rawExt = file.name.split(".").pop() || "bin";
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "") || "bin";
  const storageKey = `${session.organizationId}/${crypto.randomUUID()}.${ext}`;
  const filePath = join(UPLOAD_DIR, storageKey);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const document = await withOrgContext(session.organizationId, (tx) =>
    tx.document.create({
      data: {
        organizationId: session.organizationId,
        ownerTable,
        ownerId,
        storageKey,
        originalFilename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        uploadedByUserId: session.userId,
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "documents.upload",
    entityTable: "documents",
    entityId: document.id,
    after: {
      original_filename: file.name,
      owner_table: ownerTable,
      owner_id: ownerId,
      size_bytes: file.size,
    },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(document, reqId, 201);
}
