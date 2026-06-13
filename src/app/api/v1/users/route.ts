import { withOrgContext } from "@/lib/db";
import {
  requestId,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const role = url.searchParams.get("role") || undefined;

  const users = await withOrgContext(session.organizationId, (tx) =>
    tx.user.findMany({
      where: {
        organizationId: session.organizationId,
        ...(status ? { status: status as "active" | "deactivated" } : {}),
        ...(role ? { role: role as never } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        contactId: true,
      },
      orderBy: { createdAt: "desc" },
    })
  );

  return jsonResponse({ data: users }, reqId);
}
