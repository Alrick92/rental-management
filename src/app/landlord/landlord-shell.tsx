"use client";

import { PortalShell } from "@/components/portal-shell";

interface LandlordShellProps {
  user: {
    displayName: string;
    email: string;
    role: string;
  };
  children?: React.ReactNode;
}

const NAV_GROUPS = [
  { label: "Portfolio", href: "/landlord" },
  { label: "Financials", href: "/landlord/financials" },
  {
    label: "Services",
    items: [
      { label: "Maintenance", href: "/landlord/maintenance" },
      { label: "Messages", href: "/landlord/messages" },
      { label: "Documents", href: "/landlord/documents" },
    ],
  },
];

export function LandlordShell({ user, children }: LandlordShellProps) {
  return (
    <PortalShell
      portalName="OWNER PORTAL"
      roleBadge="Owner"
      badgeColor="#d97706"
      navGroups={NAV_GROUPS}
      user={user}
    >
      {children}
    </PortalShell>
  );
}
