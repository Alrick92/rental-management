import { withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createAnnouncementSchema, paginationSchema } from "@/lib/validators";
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
    return errorResponse(400, "validation_error", "Invalid pagination", reqId);
  }
  const { cursor, limit } = parsed.data;

  const isPortalUser = ["tenant", "landlord"].includes(session.role);

  const announcements = await withOrgContext(session.organizationId, (tx) =>
    tx.announcement.findMany({
      where: {
        organizationId: session.organizationId,
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(isPortalUser ? { publishedAt: { not: null } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        createdBy: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    })
  );

  const hasMore = announcements.length > limit;
  if (hasMore) announcements.pop();

  return jsonResponse(
    { data: announcements, next_cursor: hasMore ? announcements[announcements.length - 1].id : null },
    reqId
  );
}

export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "property_manager"]);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = createAnnouncementSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  if (data.scope === "property" && !data.property_id) {
    return errorResponse(400, "missing_property", "property_id required for property-scoped announcements", reqId);
  }

  const announcement = await withOrgContext(session.organizationId, (tx) =>
    tx.announcement.create({
      data: {
        organizationId: session.organizationId,
        title: data.title,
        body: data.body,
        scope: data.scope,
        propertyId: data.property_id ?? null,
        createdByUserId: session.userId,
        publishedAt: data.publish ? new Date() : null,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "announcements.create",
    entityTable: "announcements",
    entityId: announcement.id,
    after: announcement,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(announcement, reqId, 201);
}
