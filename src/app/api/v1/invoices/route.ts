import { withOrgContext } from "@/lib/db";
import { paginationSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
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
  const statusFilter = url.searchParams.get("status");
  const leaseFilter = url.searchParams.get("lease_id");

  const invoices = await withOrgContext(session.organizationId, (tx) =>
    tx.invoice.findMany({
      where: {
        organizationId: session.organizationId,
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(statusFilter ? { status: statusFilter as never } : {}),
        ...(leaseFilter ? { leaseId: leaseFilter } : {}),
      },
      orderBy: { dueDate: "desc" },
      take: limit + 1,
      include: {
        lease: {
          select: {
            id: true,
            unit: { select: { id: true, name: true } },
          },
        },
      },
    })
  );

  const hasMore = invoices.length > limit;
  if (hasMore) invoices.pop();

  return jsonResponse(
    {
      data: invoices,
      next_cursor: hasMore ? invoices[invoices.length - 1].id : null,
    },
    reqId
  );
}
