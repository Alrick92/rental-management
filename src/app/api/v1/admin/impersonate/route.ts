import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAdmin,
  getClientIp,
} from "@/lib/api-utils";
import { z } from "zod/v4";
import { cookies } from "next/headers";

const impersonateSchema = z.object({
  target_user_id: z.string().uuid(),
  reason: z.string().min(1).max(500).optional(),
});

/**
 * POST /api/v1/admin/impersonate
 *
 * Super admin enters an org as a target user. Creates an ImpersonationSession
 * and a regular Session for the target user, storing the impersonation context.
 */
export async function POST(request: Request) {
  const reqId = requestId();
  const auth = await requireAdmin(reqId);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON", reqId);
  }

  const parsed = impersonateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const { target_user_id, reason } = parsed.data;

  const targetUser = await prisma.user.findUnique({
    where: { id: target_user_id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      status: true,
    },
  });

  if (!targetUser || !targetUser.organizationId) {
    return errorResponse(404, "user_not_found", "Target user not found or has no organization", reqId);
  }

  if (targetUser.status === "deactivated") {
    return errorResponse(400, "user_deactivated", "Cannot impersonate a deactivated user", reqId);
  }

  // Create a session for the target user
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
  const session = await prisma.session.create({
    data: {
      userId: targetUser.id,
      organizationId: targetUser.organizationId,
      expiresAt,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
    },
  });

  // Create impersonation session record
  const impersonationSession = await prisma.impersonationSession.create({
    data: {
      superAdminUserId: auth.userId,
      targetUserId: targetUser.id,
      organizationId: targetUser.organizationId,
      sessionId: session.id,
      reason: reason || null,
    },
  });

  // Write audit log
  await writeAuditLog({
    organizationId: targetUser.organizationId,
    userId: auth.userId,
    impersonatedBySuperAdminId: auth.userId,
    action: "impersonation_start",
    entityTable: "impersonation_sessions",
    entityId: impersonationSession.id,
    after: {
      target_user_id: targetUser.id,
      target_email: targetUser.email,
      target_role: targetUser.role,
      reason,
    },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  // Set the impersonation session cookie
  const cookieStore = await cookies();
  cookieStore.set("session_id", session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 2 * 60 * 60,
  });
  // Store impersonation session ID for stop-impersonation
  cookieStore.set("impersonation_id", impersonationSession.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 2 * 60 * 60,
  });

  return jsonResponse(
    {
      impersonation_session_id: impersonationSession.id,
      target_user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      },
      organization_id: targetUser.organizationId,
      message: `Now impersonating ${targetUser.name} (${targetUser.email})`,
    },
    reqId,
    201
  );
}

/**
 * GET /api/v1/admin/impersonate
 *
 * List impersonation sessions (for admin audit view).
 */
export async function GET(request: Request) {
  const reqId = requestId();
  const auth = await requireAdmin(reqId);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1),
    200
  );

  const sessions = await prisma.impersonationSession.findMany({
    include: {
      superAdmin: { select: { id: true, name: true, email: true } },
      targetUser: { select: { id: true, name: true, email: true, role: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return jsonResponse(
    {
      data: sessions.map((s) => ({
        id: s.id,
        super_admin: s.superAdmin,
        target_user: s.targetUser,
        organization: s.organization,
        reason: s.reason,
        started_at: s.startedAt.toISOString(),
        ended_at: s.endedAt?.toISOString() || null,
      })),
    },
    reqId
  );
}
