import { prisma } from "@/lib/db";
import { revokeAllSessions } from "@/lib/auth";
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

  if (id === session.userId) {
    return errorResponse(400, "self_deactivate", "Cannot deactivate yourself", reqId);
  }

  const user = await prisma.user.findFirst({
    where: { id, organizationId: session.organizationId },
  });

  if (!user) {
    return errorResponse(404, "not_found", "User not found", reqId);
  }

  if (user.status === "deactivated") {
    return errorResponse(400, "already_deactivated", "User is already deactivated", reqId);
  }

  await prisma.user.update({
    where: { id },
    data: { status: "deactivated" },
  });

  await revokeAllSessions(id);

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "users.deactivate",
    entityTable: "users",
    entityId: id,
    before: { status: "active" },
    after: { status: "deactivated" },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse({ status: "deactivated" }, reqId);
}
