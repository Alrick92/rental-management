import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword, generateRandomPassword, generateToken } from "@/lib/password";
import { inviteUserSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";
import crypto from "crypto";

export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId, ["org_admin"]);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = inviteUserSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const { email, name, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return errorResponse(409, "email_taken", "A user with this email already exists", reqId);
  }

  const tempPassword = generateRandomPassword();
  const passwordHash = await hashPassword(tempPassword);
  const token = generateToken();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.create({
    data: {
      organizationId: session.organizationId,
      email,
      name,
      role: role as never,
      passwordHash,
      passwordMustChange: true,
    },
  });

  await prisma.userInvitation.create({
    data: {
      organizationId: session.organizationId,
      email,
      role: role as never,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedByUserId: session.userId,
    },
  });

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "users.invite",
    entityTable: "users",
    entityId: user.id,
    after: { email, name, role },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
      temporary_password: tempPassword,
    },
    reqId,
    201
  );
}
