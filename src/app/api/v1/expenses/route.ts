import { withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createExpenseSchema, paginationSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "property_manager", "agent"]);
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

  const expenses = await withOrgContext(session.organizationId, (tx) =>
    tx.expense.findMany({
      where: {
        organizationId: session.organizationId,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { expenseDate: "desc" },
      take: limit + 1,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })
  );

  const hasMore = expenses.length > limit;
  if (hasMore) expenses.pop();

  return jsonResponse(
    {
      data: expenses,
      next_cursor: hasMore ? expenses[expenses.length - 1].id : null,
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

  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;

  const expense = await withOrgContext(session.organizationId, (tx) =>
    tx.expense.create({
      data: {
        organizationId: session.organizationId,
        propertyId: data.property_id ?? null,
        unitId: data.unit_id ?? null,
        category: data.category,
        description: data.description ?? null,
        amountMinor: data.amount_minor,
        currency: data.currency,
        expenseDate: new Date(data.expense_date),
        createdByUserId: session.userId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })
  );

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "expenses.create",
    entityTable: "expenses",
    entityId: expense.id,
    after: expense,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(expense, reqId, 201);
}
