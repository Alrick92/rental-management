import { destroySession } from "@/lib/auth";
import { requestId, jsonResponse } from "@/lib/api-utils";

export async function POST() {
  const reqId = requestId();
  await destroySession();
  return jsonResponse({ ok: true }, reqId);
}
