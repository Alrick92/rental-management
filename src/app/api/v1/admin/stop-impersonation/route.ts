import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  requestId,
  errorResponse,
  jsonResponse,
  getClientIp,
} from "@/lib/api-utils";
import { cookies } from "next/headers";

/**
 * POST /api/v1/admin/stop-impersonation
 *
 * End an active impersonation session. Revokes the impersonated session
 * and marks the impersonation record as ended.
 */
export async function POST(request: Request) {
  const reqId = requestId();

  const cookieStore = await cookies();
  const impersonationId = cookieStore.get("impersonation_id")?.value;

  if (!impersonationId) {
    return errorResponse(400, "not_impersonating", "No active impersonation session", reqId);
  }

  const impersonation = await prisma.impersonationSession.findUnique({
    where: { id: impersonationId },
    include: {
      targetUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (!impersonation || impersonation.endedAt) {
    cookieStore.delete("impersonation_id");
    return errorResponse(400, "not_impersonating", "Impersonation session not found or already ended", reqId);
  }

  // End the impersonation session
  await prisma.impersonationSession.update({
    where: { id: impersonationId },
    data: { endedAt: new Date() },
  });

  // Revoke the impersonated user's session
  if (impersonation.sessionId) {
    await prisma.session.update({
      where: { id: impersonation.sessionId },
      data: { revokedAt: new Date() },
    });
  }

  // Write audit log
  await writeAuditLog({
    organizationId: impersonation.organizationId,
    userId: impersonation.superAdminUserId,
    impersonatedBySuperAdminId: impersonation.superAdminUserId,
    action: "impersonation_end",
    entityTable: "impersonation_sessions",
    entityId: impersonation.id,
    after: {
      target_user_id: impersonation.targetUserId,
      target_email: impersonation.targetUser.email,
      duration_seconds: Math.round(
        (Date.now() - impersonation.startedAt.getTime()) / 1000
      ),
    },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  // Clear cookies
  cookieStore.delete("session_id");
  cookieStore.delete("impersonation_id");

  return jsonResponse(
    {
      message: `Stopped impersonating ${impersonation.targetUser.name}`,
      impersonation_session_id: impersonation.id,
    },
    reqId
  );
}
