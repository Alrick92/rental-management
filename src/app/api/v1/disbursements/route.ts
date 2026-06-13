import { prisma, withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { generateDisbursementSchema, paginationSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

/**
 * GET /api/v1/disbursements — list disbursements
 */
export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "property_manager", "landlord"]);
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
  const propertyFilter = url.searchParams.get("property_id");
  const statusFilter = url.searchParams.get("status");

  // Landlords can only see their own disbursements
  let contactFilter: string | undefined;
  if (session.role === "landlord") {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { contactId: true },
    });
    if (!user?.contactId) {
      return errorResponse(400, "no_contact", "Landlord has no linked contact", reqId);
    }
    contactFilter = user.contactId;
  }

  const disbursements = await withOrgContext(session.organizationId, (tx) =>
    tx.landlordPayment.findMany({
      where: {
        organizationId: session.organizationId,
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...(propertyFilter ? { propertyId: propertyFilter } : {}),
        ...(statusFilter ? { status: statusFilter as never } : {}),
        ...(contactFilter ? { contactId: contactFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        property: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
      },
    })
  );

  const hasMore = disbursements.length > limit;
  if (hasMore) disbursements.pop();

  return jsonResponse(
    {
      data: disbursements,
      next_cursor: hasMore ? disbursements[disbursements.length - 1].id : null,
    },
    reqId
  );
}

/**
 * POST /api/v1/disbursements — generate a disbursement for a property + period
 *
 * Formula: rent_collected - expenses - management_fee, split by ownership share
 */
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

  const parsed = generateDisbursementSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const { property_id, period_start, period_end } = parsed.data;
  const periodStartDate = new Date(period_start);
  const periodEndDate = new Date(period_end);

  // Get org management fee
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { managementFeePercent: true, defaultCurrency: true },
  });
  if (!org) {
    return errorResponse(404, "org_not_found", "Organization not found", reqId);
  }

  // Get property and its owners
  const property = await withOrgContext(session.organizationId, (tx) =>
    tx.property.findFirst({
      where: { id: property_id, organizationId: session.organizationId },
      include: {
        owners: {
          include: { contact: { select: { id: true, name: true } } },
        },
        units: { select: { id: true } },
      },
    })
  );
  if (!property) {
    return errorResponse(404, "property_not_found", "Property not found", reqId);
  }
  if (property.owners.length === 0) {
    return errorResponse(400, "no_owners", "Property has no owners assigned", reqId);
  }

  const unitIds = property.units.map((u) => u.id);

  // Calculate rent collected (approved payments on leases for this property's units in period)
  const payments = await withOrgContext(session.organizationId, (tx) =>
    tx.payment.findMany({
      where: {
        organizationId: session.organizationId,
        status: "approved",
        lease: { unitId: { in: unitIds } },
        receivedAt: { gte: periodStartDate, lte: periodEndDate },
      },
      select: { amountMinor: true },
    })
  );
  const rentCollected = payments.reduce((sum, p) => sum + p.amountMinor, 0);

  // Calculate expenses for this property in period
  const expenses = await withOrgContext(session.organizationId, (tx) =>
    tx.expense.findMany({
      where: {
        organizationId: session.organizationId,
        propertyId: property_id,
        expenseDate: { gte: periodStartDate, lte: periodEndDate },
      },
      select: { amountMinor: true },
    })
  );
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amountMinor, 0);

  // Management fee
  const managementFee = Math.round(
    (rentCollected * org.managementFeePercent) / 100
  );

  const netTotal = rentCollected - totalExpenses - managementFee;

  // Create disbursement per owner, split by share
  const totalShares = property.owners.reduce((sum, o) => sum + o.share, 0);
  const created = [];

  for (const owner of property.owners) {
    const ownerPayout = Math.round((netTotal * owner.share) / totalShares);

    // Idempotent: check if disbursement already exists
    const existing = await withOrgContext(session.organizationId, (tx) =>
      tx.landlordPayment.findFirst({
        where: {
          organizationId: session.organizationId,
          propertyId: property_id,
          contactId: owner.contactId,
          periodStart: periodStartDate,
          periodEnd: periodEndDate,
        },
      })
    );
    if (existing) {
      created.push(existing);
      continue;
    }

    const disbursement = await withOrgContext(session.organizationId, (tx) =>
      tx.landlordPayment.create({
        data: {
          organizationId: session.organizationId,
          propertyId: property_id,
          contactId: owner.contactId,
          periodStart: periodStartDate,
          periodEnd: periodEndDate,
          rentCollectedMinor: Math.round(
            (rentCollected * owner.share) / totalShares
          ),
          expensesMinor: Math.round(
            (totalExpenses * owner.share) / totalShares
          ),
          managementFeeMinor: Math.round(
            (managementFee * owner.share) / totalShares
          ),
          netPayoutMinor: ownerPayout,
          currency: org.defaultCurrency,
        },
        include: {
          property: { select: { id: true, name: true } },
          contact: { select: { id: true, name: true } },
        },
      })
    );

    created.push(disbursement);
  }

  if (created.length > 0) {
    await writeAuditLog({
      organizationId: session.organizationId,
      userId: session.userId,
      action: "disbursements.generate",
      entityTable: "landlord_payments",
      entityId: created[0].id,
      after: {
        count: created.length,
        property_id,
        period: `${period_start} to ${period_end}`,
        rent_collected: rentCollected,
        expenses: totalExpenses,
        management_fee: managementFee,
        net_total: netTotal,
      },
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      requestId: reqId,
    });
  }

  return jsonResponse({ data: created }, reqId, 201);
}
