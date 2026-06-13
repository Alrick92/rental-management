import { withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createContactSchema, paginationSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid pagination params", reqId, {
      issues: parsed.error.issues,
    });
  }
  const { cursor, limit } = parsed.data;

  const search = url.searchParams.get("q");

  const contacts = await withOrgContext(session.organizationId, (tx) =>
    tx.contact.findMany({
      where: {
        organizationId: session.organizationId,
        deletedAt: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    })
  );

  const hasMore = contacts.length > limit;
  if (hasMore) contacts.pop();

  return jsonResponse(
    {
      data: contacts,
      next_cursor: hasMore ? contacts[contacts.length - 1].id : null,
    },
    reqId
  );
}

export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "property_manager", "agent"]);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = createContactSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  const contact = await withOrgContext(session.organizationId, (tx) =>
    tx.contact.create({
      data: {
        organizationId: session.organizationId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        idDocumentType: data.id_document_type,
        idDocumentNumber: data.id_document_number,
        address: data.address,
        notes: data.notes,
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "contacts.create",
    entityTable: "contacts",
    entityId: contact.id,
    after: contact,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(contact, reqId, 201);
}
