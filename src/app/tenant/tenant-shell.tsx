"use client";

import { PortalShell } from "@/components/portal-shell";

interface TenantShellProps {
  user: {
    displayName: string;
    email: string;
    role: string;
  };
  children?: React.ReactNode;
}

const NAV_GROUPS = [
  { label: "Dashboard", href: "/tenant" },
  {
    label: "My Lease",
    items: [
      { label: "Lease Details", href: "/tenant/lease" },
      { label: "Payments", href: "/tenant/payments" },
    ],
  },
  {
    label: "Services",
    items: [
      { label: "Maintenance", href: "/tenant/maintenance" },
      { label: "Messages", href: "/tenant/messages" },
      { label: "Announcements", href: "/tenant/announcements" },
      { label: "Documents", href: "/tenant/documents" },
    ],
  },
];

export function TenantShell({ user, children }: TenantShellProps) {
  return (
    <PortalShell
      portalName="TENANT PORTAL"
      roleBadge="Tenant"
      badgeColor="#047857"
      navGroups={NAV_GROUPS}
      user={user}
    >
      {children}
    </PortalShell>
  );
}
