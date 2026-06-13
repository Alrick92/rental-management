import { prisma } from "@/lib/db";
import { revokeAllSessions } from "@/lib/auth";
import { hashPassword, generateRandomPassword, generateToken } from "@/lib/password";
import { writeAuditLog } from "@/lib/audit";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";
import crypto from "crypto";

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

  const tempPassword = generateRandomPassword();
  const passwordHash = await hashPassword(tempPassword);
  const token = generateToken();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      passwordMustChange: true,
      passwordChangedAt: new Date(),
    },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdByUserId: session.userId,
      deliveryMethod: "displayed_to_admin",
    },
  });

  await revokeAllSessions(id);

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "users.reset_password",
    entityTable: "users",
    entityId: id,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(
    {
      temporary_password: tempPassword,
      message: "Password reset. User must change password on next login.",
    },
    reqId
  );
}
