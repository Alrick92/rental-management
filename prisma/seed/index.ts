import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../../src/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = "password123!secure";

async function main() {
  console.log("🌱 Seeding database...");

  const hash = await hashPassword(DEFAULT_PASSWORD);

  // ─── Super Admin ─────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@rental.local" },
    update: {},
    create: {
      email: "admin@rental.local",
      name: "Super Admin",
      role: "super_admin",
      passwordHash: hash,
      passwordChangedAt: new Date(),
    },
  });
  console.log(`  ✓ Super admin: ${superAdmin.email}`);

  // ─── Demo Organization ──────────────────────────────────────────────────
  const demoOrg = await prisma.organization.upsert({
    where: { slug: "demo-properties" },
    update: {},
    create: {
      name: "Demo Properties Inc.",
      slug: "demo-properties",
      status: "active",
      defaultCurrency: "USD",
      timezone: "America/New_York",
      managementFeePercent: 10,
    },
  });
  console.log(`  ✓ Organization: ${demoOrg.name}`);

  // ─── Org Admin ───────────────────────────────────────────────────────────
  const orgAdmin = await prisma.user.upsert({
    where: { email: "manager@demo-properties.com" },
    update: {},
    create: {
      email: "manager@demo-properties.com",
      name: "Jane Manager",
      role: "org_admin",
      organizationId: demoOrg.id,
      passwordHash: hash,
      passwordChangedAt: new Date(),
    },
  });
  console.log(`  ✓ Org admin: ${orgAdmin.email}`);

  // ─── Property Manager ───────────────────────────────────────────────────
  const propManager = await prisma.user.upsert({
    where: { email: "pm@demo-properties.com" },
    update: {},
    create: {
      email: "pm@demo-properties.com",
      name: "Pat PropertyMgr",
      role: "property_manager",
      organizationId: demoOrg.id,
      passwordHash: hash,
      passwordChangedAt: new Date(),
    },
  });
  console.log(`  ✓ Property manager: ${propManager.email}`);

  // ─── Agent ───────────────────────────────────────────────────────────────
  const agent = await prisma.user.upsert({
    where: { email: "agent@demo-properties.com" },
    update: {},
    create: {
      email: "agent@demo-properties.com",
      name: "Bob Agent",
      role: "agent",
      organizationId: demoOrg.id,
      passwordHash: hash,
      passwordChangedAt: new Date(),
    },
  });
  console.log(`  ✓ Agent: ${agent.email}`);

  // ─── Contacts (for landlord, tenant, etc.) ──────────────────────────────
  const landlordContact = await prisma.contact.upsert({
    where: { id: "00000000-0000-0000-0000-000000000020" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000020",
      organizationId: demoOrg.id,
      name: "Larry Landlord",
      email: "landlord@demo-properties.com",
      phone: "+1-555-0301",
    },
  });

  const tenantContact = await prisma.contact.upsert({
    where: { id: "00000000-0000-0000-0000-000000000010" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      organizationId: demoOrg.id,
      name: "Alice Tenant",
      email: "tenant@demo-properties.com",
      phone: "+1-555-0101",
    },
  });

  const maintenanceContact = await prisma.contact.upsert({
    where: { id: "00000000-0000-0000-0000-000000000030" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000030",
      organizationId: demoOrg.id,
      name: "Mike Maintenance",
      email: "maint@demo-properties.com",
      phone: "+1-555-0401",
    },
  });

  const vendorContact = await prisma.contact.upsert({
    where: { id: "00000000-0000-0000-0000-000000000040" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000040",
      organizationId: demoOrg.id,
      name: "Vince Vendor",
      email: "vendor@demo-properties.com",
      phone: "+1-555-0501",
    },
  });

  const guestContact = await prisma.contact.upsert({
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
  console.log(`  ✓ Contacts: landlord, tenant, maintenance, vendor, guest`);

  // ─── Landlord user (linked to contact) ──────────────────────────────────
  const landlord = await prisma.user.upsert({
    where: { email: "landlord@demo-properties.com" },
    update: {},
    create: {
      email: "landlord@demo-properties.com",
      name: "Larry Landlord",
      role: "landlord",
      organizationId: demoOrg.id,
      contactId: landlordContact.id,
      passwordHash: hash,
      passwordChangedAt: new Date(),
    },
  });
  console.log(`  ✓ Landlord: ${landlord.email}`);

  // ─── Tenant user (linked to contact) ───────────────────────────────────
  const tenantUser = await prisma.user.upsert({
    where: { email: "tenant@demo-properties.com" },
    update: {},
    create: {
      email: "tenant@demo-properties.com",
      name: "Alice Tenant",
      role: "tenant",
      organizationId: demoOrg.id,
      contactId: tenantContact.id,
      passwordHash: hash,
      passwordChangedAt: new Date(),
    },
  });
  console.log(`  ✓ Tenant: ${tenantUser.email}`);

  // ─── Maintenance Staff user (linked to contact) ────────────────────────
  const maintUser = await prisma.user.upsert({
    where: { email: "maint@demo-properties.com" },
    update: {},
    create: {
      email: "maint@demo-properties.com",
      name: "Mike Maintenance",
      role: "maintenance_staff",
      organizationId: demoOrg.id,
      contactId: maintenanceContact.id,
      passwordHash: hash,
      passwordChangedAt: new Date(),
    },
  });
  console.log(`  ✓ Maintenance staff: ${maintUser.email}`);

  // ─── Vendor user (linked to contact) ───────────────────────────────────
  const vendorUser = await prisma.user.upsert({
    where: { email: "vendor@demo-properties.com" },
    update: {},
    create: {
      email: "vendor@demo-properties.com",
      name: "Vince Vendor",
      role: "vendor",
      organizationId: demoOrg.id,
      contactId: vendorContact.id,
      passwordHash: hash,
      passwordChangedAt: new Date(),
    },
  });
  console.log(`  ✓ Vendor: ${vendorUser.email}`);

  // ─── Properties ─────────────────────────────────────────────────────────
  const beachProperty = await prisma.property.upsert({
    where: { id: "00000000-0000-0000-0000-100000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-100000000001",
      organizationId: demoOrg.id,
      name: "Beachside Resort",
      addressLine1: "123 Ocean Drive",
      city: "Miami Beach",
      region: "FL",
      postalCode: "33139",
      country: "US",
      primaryManagerUserId: propManager.id,
    },
  });

  const downtownProperty = await prisma.property.upsert({
    where: { id: "00000000-0000-0000-0000-100000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-100000000002",
      organizationId: demoOrg.id,
      name: "Downtown Residences",
      addressLine1: "456 Main Street",
      city: "Austin",
      region: "TX",
      postalCode: "73301",
      country: "US",
      primaryManagerUserId: propManager.id,
    },
  });
  console.log(`  ✓ Properties: ${beachProperty.name}, ${downtownProperty.name}`);

  // ─── Property Owners ───────────────────────────────────────────────────
  await prisma.propertyOwner.upsert({
    where: { propertyId_contactId: { propertyId: beachProperty.id, contactId: landlordContact.id } },
    update: {},
    create: {
      propertyId: beachProperty.id,
      contactId: landlordContact.id,
      share: 100,
    },
  });
  await prisma.propertyOwner.upsert({
    where: { propertyId_contactId: { propertyId: downtownProperty.id, contactId: landlordContact.id } },
    update: {},
    create: {
      propertyId: downtownProperty.id,
      contactId: landlordContact.id,
      share: 100,
    },
  });
  console.log(`  ✓ Property ownership assigned to landlord`);

  // ─── Units (linked to properties) ──────────────────────────────────────
  const house = await prisma.unit.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: { propertyId: beachProperty.id },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      organizationId: demoOrg.id,
      propertyId: beachProperty.id,
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
    update: { propertyId: downtownProperty.id },
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      organizationId: demoOrg.id,
      propertyId: downtownProperty.id,
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

  // ─── System Settings ───────────────────────────────────────────────────
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
  console.log("\nLogin credentials (all passwords: password123!secure):");
  console.log("  Super Admin:       admin@rental.local");
  console.log("  Org Admin:         manager@demo-properties.com");
  console.log("  Property Manager:  pm@demo-properties.com");
  console.log("  Agent:             agent@demo-properties.com");
  console.log("  Landlord:          landlord@demo-properties.com");
  console.log("  Tenant:            tenant@demo-properties.com");
  console.log("  Maintenance:       maint@demo-properties.com");
  console.log("  Vendor:            vendor@demo-properties.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
