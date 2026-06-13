import { withOrgContext } from "@/lib/db";
import { sendMessageSchema, paginationSchema } from "@/lib/validators";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
  if (session instanceof Response) return session;

  const { id: threadId } = await params;

  const url = new URL(request.url);
  const parsed = paginationSchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid pagination", reqId);
  }
  const { cursor, limit } = parsed.data;

  const thread = await withOrgContext(session.organizationId, (tx) =>
    tx.messageThread.findFirst({
      where: {
        id: threadId,
        organizationId: session.organizationId,
        participants: { some: { userId: session.userId } },
      },
      select: { id: true },
    })
  );

  if (!thread) {
    return errorResponse(404, "not_found", "Thread not found", reqId);
  }

  const messages = await withOrgContext(session.organizationId, (tx) =>
    tx.message.findMany({
      where: {
        threadId,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: limit + 1,
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    })
  );

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  return jsonResponse(
    { data: messages, next_cursor: hasMore ? messages[messages.length - 1].id : null },
    reqId
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
  if (session instanceof Response) return session;

  const { id: threadId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Invalid JSON body", reqId);
  }

  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const thread = await withOrgContext(session.organizationId, (tx) =>
    tx.messageThread.findFirst({
      where: {
        id: threadId,
        organizationId: session.organizationId,
        participants: { some: { userId: session.userId } },
      },
      select: { id: true },
    })
  );

  if (!thread) {
    return errorResponse(404, "not_found", "Thread not found", reqId);
  }

  const message = await withOrgContext(session.organizationId, async (tx) => {
    const msg = await tx.message.create({
      data: {
        threadId,
        senderUserId: session.userId,
        body: parsed.data.body,
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    await tx.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    await tx.threadParticipant.update({
      where: { threadId_userId: { threadId, userId: session.userId } },
      data: { lastReadAt: new Date() },
    });

    return msg;
  });

  return jsonResponse(message, reqId, 201);
}
