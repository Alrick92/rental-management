import { prisma } from "@/lib/db";
import {
  requestId,
  jsonResponse,
  requireAdmin,
} from "@/lib/api-utils";

/**
 * GET /api/v1/admin/audit-logs
 *
 * Cross-org audit log viewer for super_admin.
 * Filterable by organizationId, action, entityTable, userId, date range.
 */
export async function GET(request: Request) {
  const reqId = requestId();
  const auth = await requireAdmin(reqId);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1),
    200
  );
  const cursor = url.searchParams.get("cursor") || undefined;
  const orgId = url.searchParams.get("organization_id") || undefined;
  const action = url.searchParams.get("action") || undefined;
  const entityTable = url.searchParams.get("entity_table") || undefined;
  const userId = url.searchParams.get("user_id") || undefined;
  const startDate = url.searchParams.get("start_date") || undefined;
  const endDate = url.searchParams.get("end_date") || undefined;

  const where: Record<string, unknown> = {};
  if (orgId) where.organizationId = orgId;
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (entityTable) where.entityTable = entityTable;
  if (userId) where.userId = userId;
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    where.createdAt = dateFilter;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      impersonator: { select: { id: true, name: true, email: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = logs.length > limit;
  const results = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? results[results.length - 1]?.id : null;

  return jsonResponse(
    {
      data: results.map((log) => ({
        id: log.id,
        organization: log.organization,
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
