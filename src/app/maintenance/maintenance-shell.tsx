"use client";

import { PortalShell } from "@/components/portal-shell";

interface MaintenanceShellProps {
  user: {
    displayName: string;
    email: string;
    role: string;
  };
  children?: React.ReactNode;
}

const NAV_GROUPS = [
  { label: "Work Orders", href: "/maintenance" },
  { label: "Time & Costs", href: "/maintenance/costs" },
];

export function MaintenanceShell({ user, children }: MaintenanceShellProps) {
  const roleLabel = user.role === "vendor" ? "Vendor" : "Staff";

  return (
    <PortalShell
      portalName="MAINTENANCE PORTAL"
      roleBadge={roleLabel}
      badgeColor="#d97706"
      navGroups={NAV_GROUPS}
      user={user}
    >
      {children}
    </PortalShell>
  );
}
