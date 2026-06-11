import { destroyAdminSession } from "@/lib/auth";
import { requestId, jsonResponse } from "@/lib/api-utils";

export async function POST() {
  const reqId = requestId();
  await destroyAdminSession();
  return jsonResponse({ ok: true }, reqId);
}
