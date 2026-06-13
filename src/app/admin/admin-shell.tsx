"use client";

import { PortalShell } from "@/components/portal-shell";

interface AdminShellProps {
  user: {
    displayName: string;
    email: string;
    role: string;
  };
  children?: React.ReactNode;
}

const NAV_GROUPS = [
  { label: "Overview", href: "/admin" },
  {
    label: "Management",
    items: [
      { label: "Organizations", href: "/admin/organizations" },
      { label: "Impersonation", href: "/admin/impersonation" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/admin/settings" },
      { label: "Audit Log", href: "/admin/audit-log" },
    ],
  },
];

export function AdminShell({ user, children }: AdminShellProps) {
  return (
    <PortalShell
      portalName="ADMIN CONSOLE"
      roleBadge="Super Admin"
      badgeColor="#d97706"
      navGroups={NAV_GROUPS}
      user={user}
      darkMode
    >
      {children}
    </PortalShell>
  );
}
