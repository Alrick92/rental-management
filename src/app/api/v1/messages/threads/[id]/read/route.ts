import { withOrgContext } from "@/lib/db";
import {
  requestId,
  errorResponse,
  jsonResponse,
  requireAuth,
} from "@/lib/api-utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const reqId = requestId();
  const session = await requireAuth(reqId);
  if (session instanceof Response) return session;

  const { id: threadId } = await params;

  const participant = await withOrgContext(session.organizationId, (tx) =>
    tx.threadParticipant.findUnique({
      where: { threadId_userId: { threadId, userId: session.userId } },
    })
  );

  if (!participant) {
    return errorResponse(404, "not_found", "Thread not found", reqId);
  }

  await withOrgContext(session.organizationId, (tx) =>
    tx.threadParticipant.update({
      where: { threadId_userId: { threadId, userId: session.userId } },
      data: { lastReadAt: new Date() },
    })
  );

  return jsonResponse({ ok: true }, reqId);
}
