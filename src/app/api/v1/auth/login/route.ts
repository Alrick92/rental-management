import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validators";
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

  // Rate limiting: 5 attempts per 15 minutes per IP
  const rateLimitKey = `login:${ip ?? "unknown"}`;
  if (!checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
    return errorResponse(429, "rate_limited", "Too many login attempts. Try again later.", reqId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role === "super_admin") {
    return errorResponse(401, "invalid_credentials", "Invalid email or password", reqId);
  }

  if (user.status !== "active") {
    return errorResponse(401, "account_deactivated", "Account has been deactivated", reqId);
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return errorResponse(401, "invalid_credentials", "Invalid email or password", reqId);
  }

  if (!user.organizationId) {
    return errorResponse(401, "no_organization", "User is not assigned to an organization", reqId);
  }

  // Check organization status
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (!org || org.status !== "active") {
    return errorResponse(401, "org_suspended", "Organization is suspended", reqId);
  }

  const ua = request.headers.get("user-agent");
  const sessionId = await createSession(user.id, user.organizationId, ip, ua);

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "auth.login",
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
        organization_id: user.organizationId,
        role: user.role,
        display_name: user.name,
        email: user.email,
        password_must_change: user.passwordMustChange,
      },
      session_id: sessionId,
    },
    reqId
  );
}
