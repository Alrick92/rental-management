import { cookies } from "next/headers";
import { prisma } from "./db";
import type { UserRole } from "@/generated/prisma/enums";

const SESSION_COOKIE = "sid";
const ADMIN_SESSION_COOKIE = "sid_admin";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionContext {
  sessionId: string;
  userId: string;
  organizationId: string | null;
  role: UserRole;
  displayName: string;
  email: string;
}

/**
 * Reads the org session cookie, validates the session, and returns the context.
 * Returns null if unauthenticated.
 */
export async function getSession(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sid) return null;

  const session = await prisma.session.findFirst({
    where: {
      id: sid,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!session || session.user.status !== "active") return null;

  // Sliding expiration: extend session on activity
  const newExpiry = new Date(Date.now() + SESSION_MAX_AGE_MS);
  prisma.session
    .update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: newExpiry },
    })
    .catch(() => {});

  return {
    sessionId: session.id,
    userId: session.userId,
    organizationId: session.organizationId,
    role: session.user.role,
    displayName: session.user.name,
    email: session.user.email,
  };
}

/**
 * Reads the admin session cookie, validates the session, and returns the context.
 */
export async function getAdminSession(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!sid) return null;

  const session = await prisma.adminSession.findFirst({
    where: {
      id: sid,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!session || session.user.role !== "super_admin" || session.user.status !== "active")
    return null;

  const newExpiry = new Date(Date.now() + SESSION_MAX_AGE_MS);
  prisma.adminSession
    .update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: newExpiry },
    })
    .catch(() => {});

  return {
    sessionId: session.id,
    userId: session.userId,
    organizationId: null,
    role: session.user.role,
    displayName: session.user.name,
    email: session.user.email,
  };
}

/**
 * Creates a new org session and sets the cookie.
 */
export async function createSession(
  userId: string,
  organizationId: string,
  ip: string | null,
  userAgent: string | null
): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);
  const session = await prisma.session.create({
    data: { userId, organizationId, expiresAt, ip, userAgent },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return session.id;
}

/**
 * Creates a new admin session and sets the cookie.
 */
export async function createAdminSession(
  userId: string,
  ip: string | null,
  userAgent: string | null
): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);
  const session = await prisma.adminSession.create({
    data: { userId, expiresAt, ip, userAgent },
  });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return session.id;
}

/**
 * Destroys the org session.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (sid) {
    await prisma.session.update({
      where: { id: sid },
      data: { revokedAt: new Date() },
    }).catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Destroys the admin session.
 */
export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (sid) {
    await prisma.adminSession.update({
      where: { id: sid },
      data: { revokedAt: new Date() },
    }).catch(() => {});
  }
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

/**
 * Revokes all sessions for a given user (force-logout-everywhere).
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  const now = new Date();
  await Promise.all([
    prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.adminSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
}
