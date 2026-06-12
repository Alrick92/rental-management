import { v4 as uuidv4 } from "uuid";
import { getSession, getAdminSession, type SessionContext } from "./auth";
import type { UserRole } from "@/generated/prisma/enums";

export interface OrgSessionContext extends SessionContext {
  organizationId: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    request_id: string;
  };
}

export function requestId(): string {
  return uuidv4();
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  reqId: string,
  details?: Record<string, unknown>
): Response {
  const body: ApiError = {
    error: { code, message, request_id: reqId, ...(details ? { details } : {}) },
  };
  return Response.json(body, {
    status,
    headers: { "X-Request-Id": reqId },
  });
}

export function jsonResponse(
  data: unknown,
  reqId: string,
  status = 200
): Response {
  return Response.json(data, {
    status,
    headers: { "X-Request-Id": reqId },
  });
}

/**
 * Extracts client IP from request headers.
 */
export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((s) => s.trim());
    return ips[ips.length - 1] ?? null;
  }
  return request.headers.get("x-real-ip") ?? null;
}

/**
 * Requires an authenticated org-level session with one of the allowed roles.
 * Returns the session context or a 401/403 Response.
 */
export async function requireAuth(
  reqId: string,
  allowedRoles?: UserRole[]
): Promise<OrgSessionContext | Response> {
  const session = await getSession();
  if (!session) {
    return errorResponse(401, "unauthenticated", "Not authenticated", reqId);
  }
  if (!session.organizationId) {
    return errorResponse(401, "no_organization", "User has no organization", reqId);
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return errorResponse(403, "forbidden", "Insufficient permissions", reqId);
  }
  return session as OrgSessionContext;
}

/**
 * Requires an authenticated super-admin session.
 */
export async function requireAdmin(
  reqId: string
): Promise<SessionContext | Response> {
  const session = await getAdminSession();
  if (!session) {
    return errorResponse(401, "unauthenticated", "Not authenticated", reqId);
  }
  if (session.role !== "super_admin") {
    return errorResponse(403, "forbidden", "Super-admin access required", reqId);
  }
  return session;
}

/**
 * Rate-limiter state (in-memory, per-process). Adequate for single-instance v1.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false;
  }

  entry.count++;
  return true;
}
