import { PrismaClient } from "@/generated/prisma/client";
import type { PrismaClient as PrismaClientType } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientType };

function createClient(): PrismaClientType {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }) as unknown as PrismaClientType;
}

export const prisma: PrismaClientType =
  globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Executes a callback within an RLS-scoped transaction.
 * Sets `app.current_organization_id` so Postgres RLS policies filter by org.
 */
export async function withOrgContext<T>(
  organizationId: string,
  fn: (tx: PrismaClientType) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_organization_id', $1, true)`,
      organizationId
    );
    return fn(tx as unknown as PrismaClientType);
  });
}
