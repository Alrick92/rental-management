import { getSession } from "@/lib/auth";
import { portalPathForRole } from "@/lib/rbac";
import { requestId, errorResponse, jsonResponse } from "@/lib/api-utils";

export async function GET() {
  const reqId = requestId();
  const session = await getSession();
  if (!session) {
    return errorResponse(401, "unauthenticated", "Not authenticated", reqId);
  }

  return jsonResponse(
    {
      user_id: session.userId,
      organization_id: session.organizationId,
      role: session.role,
      display_name: session.displayName,
      email: session.email,
      portal_path: portalPathForRole(session.role),
    },
    reqId
  );
}
