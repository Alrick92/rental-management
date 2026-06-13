import type { UserRole } from "@/generated/prisma/enums";

/**
 * Roles that can manage back-office operations (create/edit units, leases, etc.)
 */
export const BACK_OFFICE_ROLES: UserRole[] = [
  "org_admin",
  "property_manager",
  "agent",
];

/**
 * Roles that can manage users and org settings
 */
export const ADMIN_ROLES: UserRole[] = ["org_admin"];

/**
 * Roles that can record and approve payments
 */
export const PAYMENT_ROLES: UserRole[] = [
  "org_admin",
  "property_manager",
  "agent",
];

/**
 * Roles that can approve/reject tenant-submitted payments
 */
export const PAYMENT_APPROVAL_ROLES: UserRole[] = [
  "org_admin",
  "property_manager",
];

/**
 * Roles that can manage maintenance tickets
 */
export const MAINTENANCE_MANAGE_ROLES: UserRole[] = [
  "org_admin",
  "property_manager",
  "agent",
];

/**
 * Roles that can log time/cost on work orders
 */
export const FIELD_ROLES: UserRole[] = ["maintenance_staff", "vendor"];

/**
 * Returns true if the role bypasses property-manager scoping (sees all org data)
 */
export function bypassesPropertyScope(role: UserRole): boolean {
  return role === "org_admin" || role === "super_admin";
}

/**
 * Portal role routing: returns the base path for a given role.
 */
export function portalPathForRole(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "/admin";
    case "org_admin":
    case "property_manager":
    case "agent":
      return "/dashboard";
    case "landlord":
      return "/landlord";
    case "tenant":
      return "/tenant";
    case "maintenance_staff":
    case "vendor":
      return "/maintenance";
    default:
      return "/dashboard";
  }
}
