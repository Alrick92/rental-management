import { withOrgContext } from "@/lib/db";
import {
  requestId,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

/**
 * GET /api/v1/tenant/lease
 *
 * Returns the tenant's active lease details.
 */
export async function GET() {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["tenant"]);
  if (session instanceof Response) return session;

  const user = await withOrgContext(session.organizationId, (tx) =>
    tx.user.findUnique({
      where: { id: session.userId },
      select: { contactId: true },
    })
  );

  if (!user?.contactId) {
    return jsonResponse({ leases: [] }, reqId);
  }

  const leaseTenants = await withOrgContext(session.organizationId, (tx) =>
    tx.leaseTenant.findMany({
      where: { contactId: user.contactId! },
      select: {
        role: true,
        lease: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            monthlyRentMinor: true,
            currency: true,
            securityDepositMinor: true,
            rentDueDay: true,
            signedAt: true,
            unit: {
              select: {
                id: true,
                name: true,
                property: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    })
  );

  const leases = leaseTenants.map((lt) => ({
    ...lt.lease,
    tenantRole: lt.role,
  }));

  return jsonResponse({ leases }, reqId);
}
