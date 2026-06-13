"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface DashboardShellProps {
  user: {
    displayName: string;
    email: string;
    role: string;
  };
  children?: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  href?: string;
  items?: NavItem[];
  adminOnly?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  { label: "Dashboard", href: "/dashboard" },
  {
    label: "Properties",
    items: [
      { label: "Properties", href: "/dashboard/properties" },
      { label: "Units", href: "/dashboard/units" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Contacts", href: "/dashboard/contacts" },
      { label: "Users", href: "/dashboard/users", adminOnly: true },
    ],
  },
  {
    label: "Leasing",
    items: [
      { label: "Leases", href: "/dashboard/leases" },
      { label: "Bookings", href: "/dashboard/bookings" },
      { label: "Calendar", href: "/dashboard/calendar" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Payments", href: "/dashboard/payments" },
      { label: "Invoices", href: "/dashboard/invoices" },
      { label: "Expenses", href: "/dashboard/expenses" },
      { label: "Reports", href: "/dashboard/reports" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Maintenance", href: "/dashboard/maintenance" },
      { label: "Documents", href: "/dashboard/documents" },
      { label: "Messages", href: "/dashboard/messages" },
      { label: "Announcements", href: "/dashboard/announcements" },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      { label: "Org Settings", href: "/dashboard/org-settings" },
      { label: "Currencies", href: "/dashboard/currencies" },
      { label: "Audit Log", href: "/dashboard/audit-log" },
      { label: "GDPR", href: "/dashboard/gdpr" },
      { label: "Search", href: "/dashboard/search" },
    ],
  },
];

function SidebarGroup({
  group,
  pathname,
  isAdmin,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const items = (group.items || []).filter((item) => !item.adminOnly || isAdmin);
  const isActive = group.href
    ? pathname === group.href
    : items.some((item) => pathname === item.href);
  const [expanded, setExpanded] = useState(isActive);

  if (group.href) {
    return (
      <Link
        href={group.href}
        onClick={onNavigate}
        className={`flex items-center px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[#f1f5f9] ${
          pathname === group.href
            ? "bg-[#f1f5f9] text-[#1a365d] border-l-3 border-[#d97706]"
            : "text-[#64748b] hover:text-[#1e293b] border-l-3 border-transparent"
        }`}
      >
        {group.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[#f1f5f9] ${
          isActive
            ? "text-[#1a365d] border-l-3 border-[#d97706]"
            : "text-[#64748b] hover:text-[#1e293b] border-l-3 border-transparent"
        }`}
      >
        <span>{group.label}</span>
        <svg
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="bg-[#f8fafc]">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`block py-2 pl-8 pr-4 text-sm transition-colors hover:bg-[#f1f5f9] ${
                pathname === item.href
                  ? "font-medium text-[#1a365d] border-l-2 border-[#d97706] ml-2"
                  : "text-[#64748b] hover:text-[#1e293b]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user.role === "org_admin";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleGroups = NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin);

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 border-r border-[#e2e8f0] bg-white flex-shrink-0">
        {/* Brand */}
        <div className="flex items-center px-4 py-4 border-b border-[#e2e8f0]">
          <h1 className="text-sm font-bold uppercase tracking-wide text-[#1a365d]">
            Rental Manager
          </h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {visibleGroups.map((group) => (
            <SidebarGroup
              key={group.label}
              group={group}
              pathname={pathname}
              isAdmin={isAdmin}
            />
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-[#e2e8f0] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-[#1e293b]">
                {user.displayName}
              </p>
              <span className="inline-block mt-0.5 border border-[#d97706] bg-[#d97706]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#d97706]">
                {user.role.replace("_", " ")}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-[#64748b] hover:text-[#1e293b] transition-colors"
              title="Sign out"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full flex flex-col bg-white shadow-xl">
            {/* Brand */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-[#e2e8f0]">
              <h1 className="text-sm font-bold uppercase tracking-wide text-[#1a365d]">
                Rental Manager
              </h1>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 text-[#64748b]"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="square" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-2">
              {visibleGroups.map((group) => (
                <SidebarGroup
                  key={group.label}
                  group={group}
                  pathname={pathname}
                  isAdmin={isAdmin}
                  onNavigate={() => setSidebarOpen(false)}
                />
              ))}
            </nav>

            {/* User */}
            <div className="border-t border-[#e2e8f0] px-4 py-3">
              <p className="text-xs font-medium truncate text-[#1e293b]">
                {user.displayName}
              </p>
              <button
                onClick={handleLogout}
                className="mt-2 text-xs text-[#64748b] hover:text-[#1e293b] transition-colors"
              >
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafc]">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0] bg-[#1a365d]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-1"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-sm font-bold uppercase tracking-wide text-white">Rental Manager</h1>
          <span className="border border-[#d97706] bg-[#d97706]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#d97706]">
            {user.role.replace("_", " ")}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
