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

const updateSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
  description: z.string().max(500).optional(),
});

/**
 * GET /api/v1/admin/system-settings
 *
 * List all system settings (super_admin only).
 */
export async function GET(_request: Request) {
  const reqId = requestId();
  const auth = await requireAdmin(reqId);
  if (auth instanceof Response) return auth;

  const settings = await prisma.systemSetting.findMany({
    orderBy: { key: "asc" },
  });

  return jsonResponse(
    {
      data: settings.map((s) => ({
        key: s.key,
        value: s.value,
        description: s.description,
        updated_at: s.updatedAt.toISOString(),
      })),
    },
    reqId
  );
}

/**
 * PUT /api/v1/admin/system-settings
 *
 * Upsert a system setting (super_admin only).
 */
export async function PUT(request: Request) {
  const reqId = requestId();
  const auth = await requireAdmin(reqId);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON", reqId);
  }

  const parsed = updateSettingSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.systemSetting.findUnique({
    where: { key: parsed.data.key },
  });

  const setting = await prisma.systemSetting.upsert({
    where: { key: parsed.data.key },
    create: {
      key: parsed.data.key,
      value: parsed.data.value as object,
      description: parsed.data.description || null,
      updatedByUserId: auth.userId,
    },
    update: {
      value: parsed.data.value as object,
      description: parsed.data.description ?? undefined,
      updatedByUserId: auth.userId,
      updatedAt: new Date(),
    },
  });

  await writeAuditLog({
    userId: auth.userId,
    action: existing ? "update" : "create",
    entityTable: "system_settings",
    entityId: parsed.data.key,
    before: existing ? { value: existing.value } : undefined,
    after: { value: parsed.data.value },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(
    {
      key: setting.key,
      value: setting.value,
      description: setting.description,
      updated_at: setting.updatedAt.toISOString(),
    },
    reqId
  );
}
