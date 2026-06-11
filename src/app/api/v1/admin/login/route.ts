import { prisma } from "@/lib/db";
import { createAdminSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { adminLoginSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import {
  requestId,
  errorResponse,
  jsonResponse,
  getClientIp,
  checkRateLimit,
} from "@/lib/api-utils";

export async function POST(request: Request) {
  const reqId = requestId();
  const ip = getClientIp(request);

  const rateLimitKey = `admin_login:${ip ?? "unknown"}`;
  if (!checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
    return errorResponse(429, "rate_limited", "Too many login attempts. Try again later.", reqId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "super_admin") {
    return errorResponse(401, "invalid_credentials", "Invalid email or password", reqId);
  }

  if (user.status !== "active") {
    return errorResponse(401, "account_deactivated", "Account has been deactivated", reqId);
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return errorResponse(401, "invalid_credentials", "Invalid email or password", reqId);
  }

  const ua = request.headers.get("user-agent");
  const sessionId = await createAdminSession(user.id, ip, ua);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAuditLog({
    userId: user.id,
    action: "auth.admin_login",
    entityTable: "users",
    entityId: user.id,
    ip,
    userAgent: ua,
    requestId: reqId,
  });

  return jsonResponse(
    {
      user: {
        id: user.id,
        role: user.role,
        display_name: user.name,
        email: user.email,
      },
      session_id: sessionId,
    },
    reqId
  );
}
