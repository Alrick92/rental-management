import { withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { saveFile } from "@/lib/storage";
import { paginationSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

const ALLOWED_OWNER_TABLES = ["units", "contacts", "leases", "bookings", "maintenance_tickets"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid query parameters", reqId);
  }

  const ownerTable = url.searchParams.get("owner_table");
  const ownerId = url.searchParams.get("owner_id");

  const where: Record<string, unknown> = {
    organizationId: session.organizationId,
    deletedAt: null,
  };
  if (ownerTable) where.ownerTable = ownerTable;
  if (ownerId) where.ownerId = ownerId;
  if (parsed.data.cursor) where.id = { gt: parsed.data.cursor };

  const data = await withOrgContext(session.organizationId, (tx) =>
    tx.document.findMany({
      where,
      take: parsed.data.limit,
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    })
  );

  return jsonResponse(
    { data, next_cursor: data.length === parsed.data.limit ? data[data.length - 1]?.id : null },
    reqId
  );
}

export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return errorResponse(400, "invalid_content_type", "Expected multipart/form-data", reqId);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, "invalid_form_data", "Could not parse form data", reqId);
  }

  const file = formData.get("file");
  const ownerTable = formData.get("owner_table");
  const ownerId = formData.get("owner_id");

  if (!(file instanceof File)) {
    return errorResponse(400, "missing_file", "file field is required", reqId);
  }
  if (typeof ownerTable !== "string" || !ALLOWED_OWNER_TABLES.includes(ownerTable)) {
    return errorResponse(400, "invalid_owner_table", `owner_table must be one of: ${ALLOWED_OWNER_TABLES.join(", ")}`, reqId);
  }
  if (typeof ownerId !== "string" || !ownerId) {
    return errorResponse(400, "missing_owner_id", "owner_id is required", reqId);
  }

  if (file.size > MAX_FILE_SIZE) {
    return errorResponse(400, "file_too_large", "File must be under 20 MB", reqId);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { storageKey, sizeBytes } = await saveFile(buffer, file.name);

  const document = await withOrgContext(session.organizationId, (tx) =>
    tx.document.create({
      data: {
        organizationId: session.organizationId,
        ownerTable,
        ownerId,
        storageKey,
        originalFilename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes,
        uploadedByUserId: session.userId,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "documents.upload",
    entityTable: "documents",
    entityId: document.id,
    after: { ownerTable, ownerId, originalFilename: file.name, sizeBytes },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(document, reqId, 201);
}
