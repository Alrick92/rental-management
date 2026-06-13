import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  const { id } = await context.params;

  const user = await prisma.user.findFirst({
    where: { id, organizationId: session.organizationId },
  });

  if (!user) {
    return errorResponse(404, "not_found", "User not found", reqId);
  }

  if (user.status === "active") {
    return errorResponse(400, "already_active", "User is already active", reqId);
  }

  await prisma.user.update({
    where: { id },
    data: { status: "active" },
  });

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "users.reactivate",
    entityTable: "users",
    entityId: id,
    before: { status: "deactivated" },
    after: { status: "active" },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse({ status: "active" }, reqId);
}
