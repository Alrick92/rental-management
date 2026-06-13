import { prisma, withOrgContext } from "@/lib/db";
import {
  requestId,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

/**
 * GET /api/v1/audit-logs
 *
 * Org-scoped audit log viewer for org_admin.
 * Filterable by action, entityTable, userId, date range. Paginated.
 */
export async function GET(request: Request) {
  const reqId = requestId();
  const auth = await requireAuth(reqId, ["org_admin"]);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1),
    200
  );
  const cursor = url.searchParams.get("cursor") || undefined;
  const action = url.searchParams.get("action") || undefined;
  const entityTable = url.searchParams.get("entity_table") || undefined;
  const userId = url.searchParams.get("user_id") || undefined;
  const startDate = url.searchParams.get("start_date") || undefined;
  const endDate = url.searchParams.get("end_date") || undefined;

  const where: Record<string, unknown> = {
    organizationId: auth.organizationId,
  };
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (entityTable) where.entityTable = entityTable;
  if (userId) where.userId = userId;
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.createdAt = dateFilter;
  }

  const logs = await withOrgContext(auth.organizationId, () =>
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        impersonator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
  );

  const hasMore = logs.length > limit;
  const results = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? results[results.length - 1]?.id : null;

  return jsonResponse(
    {
      data: results.map((log) => ({
        id: log.id,
        user: log.user,
        impersonated_by: log.impersonator || null,
        action: log.action,
        entity_table: log.entityTable,
        entity_id: log.entityId,
        before: log.before,
        after: log.after,
        ip: log.ip,
        request_id: log.requestId,
        created_at: log.createdAt.toISOString(),
      })),
      next_cursor: nextCursor,
      has_more: hasMore,
    },
    reqId
  );
}
