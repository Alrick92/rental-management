import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../../src/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Create super admin
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? "admin123!secure";
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@rental.local" },
    update: {},
    create: {
      email: "admin@rental.local",
      name: "Super Admin",
      role: "super_admin",
      passwordHash: await hashPassword(superAdminPassword),
      passwordChangedAt: new Date(),
    },
  });
  console.log(`  ✓ Super admin: ${superAdmin.email}`);

  // Create demo organization
  const demoOrg = await prisma.organization.upsert({
    where: { slug: "demo-properties" },
    update: {},
    create: {
      name: "Demo Properties Inc.",
      slug: "demo-properties",
      status: "active",
    },
  });
  console.log(`  ✓ Organization: ${demoOrg.name} (${demoOrg.slug})`);

  // Create org admin
  const orgAdminPassword = process.env.ORG_ADMIN_PASSWORD ?? "manager123!secure";
  const orgAdmin = await prisma.user.upsert({
    where: { email: "manager@demo-properties.com" },
    update: {},
    create: {
      email: "manager@demo-properties.com",
      name: "Jane Manager",
      role: "org_admin",
      organizationId: demoOrg.id,
      passwordHash: await hashPassword(orgAdminPassword),
      passwordChangedAt: new Date(),
    },
  });
  console.log(`  ✓ Org admin: ${orgAdmin.email}`);

  // Create agent
  const agentPassword = process.env.AGENT_PASSWORD ?? "agent123!secure";
  const agent = await prisma.user.upsert({
    where: { email: "agent@demo-properties.com" },
    update: {},
    create: {
      email: "agent@demo-properties.com",
      name: "Bob Agent",
      role: "agent",
      organizationId: demoOrg.id,
      passwordHash: await hashPassword(agentPassword),
      passwordChangedAt: new Date(),
    },
  });
  console.log(`  ✓ Agent: ${agent.email}`);

  // Create sample units
  const house = await prisma.unit.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      organizationId: demoOrg.id,
      name: "Sunset Villa",
      unitKind: "house",
      isRentable: true,
      rentalType: "both",
      addressLine1: "123 Ocean Drive",
      city: "Miami Beach",
      region: "FL",
      postalCode: "33139",
      country: "US",
      bedrooms: 3,
      bathrooms: 2,
      maxOccupancy: 6,
    },
  });
  console.log(`  ✓ Unit: ${house.name}`);

  const apartment = await prisma.unit.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      organizationId: demoOrg.id,
      name: "Downtown Loft #4A",
      unitKind: "apartment",
      isRentable: true,
      rentalType: "long_term",
      addressLine1: "456 Main Street",
      city: "Austin",
      region: "TX",
      postalCode: "73301",
      country: "US",
      bedrooms: 2,
      bathrooms: 1,
    },
  });
  console.log(`  ✓ Unit: ${apartment.name}`);

  // Create sample contacts
  const tenant = await prisma.contact.upsert({
    where: { id: "00000000-0000-0000-0000-000000000010" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      organizationId: demoOrg.id,
      name: "Alice Tenant",
      email: "alice@example.com",
      phone: "+1-555-0101",
    },
  });
  console.log(`  ✓ Contact: ${tenant.name}`);

  const guest = await prisma.contact.upsert({
    where: { id: "00000000-0000-0000-0000-000000000011" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000011",
      organizationId: demoOrg.id,
      name: "Charlie Guest",
      email: "charlie@example.com",
      phone: "+1-555-0202",
    },
  });
  console.log(`  ✓ Contact: ${guest.name}`);

  // Create default system settings
  const settings = [
    { key: "app.name", value: "Rental Manager", description: "Application display name" },
    { key: "app.default_currency", value: "USD", description: "Default currency (ISO 4217)" },
    { key: "app.default_timezone", value: "UTC", description: "Default timezone" },
    { key: "app.min_password_length", value: 12, description: "Minimum password length" },
    { key: "reminder.lease_expiration_days", value: [60, 30, 7], description: "Days before lease expiry to send reminders" },
    { key: "reminder.rent_due_days", value: [-3, 0, 3], description: "Days relative to rent due date to send reminders" },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
      },
    });
  }
  console.log(`  ✓ System settings (${settings.length} entries)`);

  console.log("\n✅ Seed complete!");
  console.log("\nLogin credentials:");
  console.log(`  Super Admin: admin@rental.local / ${superAdminPassword}`);
  console.log(`  Org Admin:   manager@demo-properties.com / ${orgAdminPassword}`);
  console.log(`  Agent:       agent@demo-properties.com / ${agentPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
