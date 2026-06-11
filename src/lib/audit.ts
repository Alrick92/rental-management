import { prisma } from "./db";

export async function writeAuditLog(params: {
  organizationId?: string | null;
  userId: string;
  impersonatedBySuperAdminId?: string | null;
  action: string;
  entityTable: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId ?? undefined,
      userId: params.userId,
      impersonatedBySuperAdminId:
        params.impersonatedBySuperAdminId ?? undefined,
      action: params.action,
      entityTable: params.entityTable,
      entityId: params.entityId,
      before: params.before ? (params.before as object) : undefined,
      after: params.after ? (params.after as object) : undefined,
      ip: params.ip ?? undefined,
      userAgentStr: params.userAgent ?? undefined,
      requestId: params.requestId ?? undefined,
    },
  });
}
