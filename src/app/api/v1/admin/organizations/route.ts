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

const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  default_currency: z.string().length(3).default("USD"),
  timezone: z.string().default("UTC"),
});

const updateOrgSchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  name: z.string().min(1).max(255).optional(),
  timezone: z.string().optional(),
});

/**
 * GET /api/v1/admin/organizations
 *
 * List all organizations (super_admin only).
 */
export async function GET(request: Request) {
  const reqId = requestId();
  const auth = await requireAdmin(reqId);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;

  const where: Record<string, unknown> = {};
  if (status === "active" || status === "suspended") where.status = status;

  const orgs = await prisma.organization.findMany({
    where,
    include: {
      _count: { select: { users: true, properties: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonResponse(
    {
      data: orgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        default_currency: org.defaultCurrency,
        timezone: org.timezone,
        user_count: org._count.users,
        property_count: org._count.properties,
        created_at: org.createdAt.toISOString(),
      })),
    },
    reqId
  );
}

/**
 * POST /api/v1/admin/organizations
 *
 * Create a new organization (super_admin only).
 */
export async function POST(request: Request) {
  const reqId = requestId();
  const auth = await requireAdmin(reqId);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON", reqId);
  }

  const parsed = createOrgSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.organization.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (existing) {
    return errorResponse(409, "slug_taken", "Organization slug already exists", reqId);
  }

  const org = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      defaultCurrency: parsed.data.default_currency,
      timezone: parsed.data.timezone,
    },
  });

  await writeAuditLog({
    organizationId: org.id,
    userId: auth.userId,
    action: "create",
    entityTable: "organizations",
    entityId: org.id,
    after: { name: org.name, slug: org.slug },
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(
    {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      default_currency: org.defaultCurrency,
      timezone: org.timezone,
      created_at: org.createdAt.toISOString(),
    },
    reqId,
    201
  );
}

/**
 * PATCH /api/v1/admin/organizations
 *
 * Update an organization (super_admin only). Requires ?id=<orgId>.
 */
export async function PATCH(request: Request) {
  const reqId = requestId();
  const auth = await requireAdmin(reqId);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const orgId = url.searchParams.get("id");
  if (!orgId) {
    return errorResponse(400, "missing_id", "Organization id required as query param", reqId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON", reqId);
  }

  const parsed = updateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "validation_error", "Invalid input", reqId, {
      issues: parsed.error.issues,
    });
  }

  const existing = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!existing) {
    return errorResponse(404, "not_found", "Organization not found", reqId);
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.status) data.status = parsed.data.status;
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.timezone) data.timezone = parsed.data.timezone;

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data,
  });

  await writeAuditLog({
    organizationId: orgId,
    userId: auth.userId,
    action: parsed.data.status ? `org_${parsed.data.status}` : "update",
    entityTable: "organizations",
    entityId: orgId,
    before: { status: existing.status, name: existing.name },
    after: data,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    requestId: reqId,
  });

  return jsonResponse(
    {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      status: updated.status,
      default_currency: updated.defaultCurrency,
      timezone: updated.timezone,
    },
    reqId
  );
}
