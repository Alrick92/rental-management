import { prisma, withOrgContext } from "@/lib/db";
import { quoteQuerySchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin", "agent"]);
  if (session instanceof Response) return session;

  const { id } = await params;
  const url = new URL(request.url);

  const parsed = quoteQuerySchema.safeParse({
    check_in: url.searchParams.get("check_in"),
    check_out: url.searchParams.get("check_out"),
  });
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "check_in and check_out are required (YYYY-MM-DD)", reqId, {
      issues: parsed.error.issues,
    });
  }

  const checkIn = new Date(parsed.data.check_in);
  const checkOut = new Date(parsed.data.check_out);

  if (checkOut <= checkIn) {
    return errorResponse(400, "invalid_dates", "check_out must be after check_in", reqId);
  }

  const unit = await prisma.unit.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, name: true, rentalType: true },
  });
  if (!unit) {
    return errorResponse(404, "not_found", "Unit not found", reqId);
  }

  if (unit.rentalType !== "short_term" && unit.rentalType !== "both") {
    return errorResponse(400, "invalid_unit_type", "Quotes are only available for short-term or both rental types", reqId);
  }

  // Fetch all rate plans for this unit with their periods
  const ratePlans = await withOrgContext(session.organizationId, (tx) =>
    tx.ratePlan.findMany({
      where: { unitId: id },
      include: { periods: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    })
  );

  if (ratePlans.length === 0) {
    return errorResponse(400, "no_rate_plans", "No rate plans configured for this unit. Create a rate plan first.", reqId);
  }

  const defaultPlan = ratePlans.find((rp) => rp.isDefault);

  // Calculate nightly rates for each night of the stay
  const nights: Array<{ date: string; rate: number; currency: string; plan_name: string }> = [];
  const current = new Date(checkIn);
  let totalMinor = 0;
  let currency: string | null = null;

  while (current < checkOut) {
    const dateStr = current.toISOString().split("T")[0];

    // Find the best matching rate for this date:
    // 1. Highest priority plan with a period covering this date
    // 2. If tied, most recently created plan
    // 3. Fallback to default plan's period (if any covers this date)
    // 4. Fallback to default plan's latest period as catch-all
    let matchedRate: number | null = null;
    let matchedCurrency: string | null = null;
    let matchedPlanName: string | null = null;

    for (const plan of ratePlans) {
      for (const period of plan.periods) {
        const pStart = new Date(period.startDate);
        const pEnd = new Date(period.endDate);
        if (current >= pStart && current <= pEnd) {
          matchedRate = period.nightlyRate;
          matchedCurrency = period.currency;
          matchedPlanName = plan.name;
          break;
        }
      }
      if (matchedRate !== null) break;
    }

    // Fallback to default plan
    if (matchedRate === null && defaultPlan) {
      const defaultPeriods = defaultPlan.periods;
      if (defaultPeriods.length > 0) {
        const fallbackPeriod = defaultPeriods[defaultPeriods.length - 1];
        matchedRate = fallbackPeriod.nightlyRate;
        matchedCurrency = fallbackPeriod.currency;
        matchedPlanName = defaultPlan.name + " (default)";
      }
    }

    if (matchedRate === null || matchedCurrency === null) {
      return errorResponse(400, "no_rate_for_date", `No rate plan covers ${dateStr} and no default plan exists`, reqId);
    }

    if (currency === null) {
      currency = matchedCurrency;
    } else if (currency !== matchedCurrency) {
      return errorResponse(400, "currency_mismatch", `Rate plans use mixed currencies (${currency} vs ${matchedCurrency}). All rates must use the same currency.`, reqId);
    }

    nights.push({
      date: dateStr,
      rate: matchedRate,
      currency: matchedCurrency,
      plan_name: matchedPlanName!,
    });
    totalMinor += matchedRate;

    current.setDate(current.getDate() + 1);
  }

  // Check min/max night constraints from the matched plans
  const numNights = nights.length;

  return jsonResponse({
    unit: { id: unit.id, name: unit.name },
    check_in: parsed.data.check_in,
    check_out: parsed.data.check_out,
    num_nights: numNights,
    total_amount_minor: totalMinor,
    currency: currency!,
    nightly_breakdown: nights,
  }, reqId);
}
