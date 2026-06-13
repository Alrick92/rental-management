import { withOrgContext } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createThreadSchema, paginationSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
  getClientIp,
} from "@/lib/api-utils";

export async function GET(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid pagination params", reqId);
  }
  const { cursor, limit } = parsed.data;

  const threads = await withOrgContext(session.organizationId, (tx) =>
    tx.messageThread.findMany({
      where: {
        organizationId: session.organizationId,
        participants: { some: { userId: session.userId } },
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit + 1,
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: { select: { id: true, name: true } } },
        },
        property: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    })
  );

  const hasMore = threads.length > limit;
  if (hasMore) threads.pop();

  const data = threads.map((t) => {
    const myParticipation = t.participants.find((p) => p.userId === session.userId);
    const lastMessage = t.messages[0] ?? null;
    const unread = myParticipation?.lastReadAt
      ? (lastMessage && lastMessage.createdAt > myParticipation.lastReadAt)
      : t._count.messages > 0;
    return {
      id: t.id,
      subject: t.subject,
      propertyId: t.propertyId,
      property: t.property,
      participants: t.participants.map((p) => ({
        userId: p.user.id,
        name: p.user.name,
        role: p.user.role,
      })),
      lastMessage: lastMessage
        ? { body: lastMessage.body, sender: lastMessage.sender, createdAt: lastMessage.createdAt }
        : null,
      messageCount: t._count.messages,
      unread,
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
    };
  });

  return jsonResponse(
    { data, next_cursor: hasMore ? threads[threads.length - 1].id : null },
    reqId
  );
}

export async function POST(request: Request) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = createThreadSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;
  const allParticipantIds = [...new Set([session.userId, ...data.participant_ids])];

  const users = await withOrgContext(session.organizationId, (tx) =>
    tx.user.findMany({
      where: { id: { in: allParticipantIds }, organizationId: session.organizationId },
      select: { id: true },
    })
  );
  if (users.length !== allParticipantIds.length) {
    return errorResponse(400, "invalid_participants", "One or more participant IDs are invalid", reqId);
  }

  const thread = await withOrgContext(session.organizationId, async (tx) => {
    const created = await tx.messageThread.create({
      data: {
        organizationId: session.organizationId,
        subject: data.subject,
        propertyId: data.property_id ?? null,
        createdByUserId: session.userId,
        participants: {
          create: allParticipantIds.map((uid) => ({
            userId: uid,
            lastReadAt: uid === session.userId ? new Date() : null,
          })),
        },
        messages: {
          create: {
            senderUserId: session.userId,
            body: data.body,
          },
        },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, role: true } } },
        },
        messages: {
          include: { sender: { select: { id: true, name: true } } },
        },
      },
    });
    return created;
  });

  await writeAuditLog({
    organizationId: session.organizationId,
    userId: session.userId,
    action: "messages.thread.create",
    entityTable: "message_threads",
    entityId: thread.id,
    after: { subject: thread.subject, participants: allParticipantIds },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(thread, reqId, 201);
}
