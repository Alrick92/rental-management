"use client";

import { useState, useRef, useEffect } from "react";
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

interface NavGroup {
  label: string;
  href?: string;
  items?: { label: string; href: string; adminOnly?: boolean }[];
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
      { label: "Audit Log", href: "/dashboard/audit-log" },
      { label: "GDPR", href: "/dashboard/gdpr" },
      { label: "Search", href: "/dashboard/search" },
    ],
  },
];

function NavDropdown({
  group,
  pathname,
  isAdmin,
}: {
  group: NavGroup;
  pathname: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const items = group.items?.filter((item) => !item.adminOnly || isAdmin) || [];
  const isActive = items.some((item) => pathname === item.href);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
          isActive
            ? "border-[#d97706] text-[#1a365d]"
            : "border-transparent text-[#64748b] hover:border-[#cbd5e1] hover:text-[#1e293b]"
        }`}
      >
        {group.label}
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-px min-w-[180px] border border-[#e2e8f0] bg-white shadow-md">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2.5 text-sm transition-colors ${
                pathname === item.href
                  ? "bg-[#f8fafc] font-medium text-[#1a365d] border-l-2 border-[#d97706]"
                  : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b]"
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

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="bg-[#1a365d]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold tracking-tight text-white">RENTAL MANAGER</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300">
              {user.displayName}
              <span className="ml-2 border border-[#d97706] bg-[#d97706]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#d97706]">
                {user.role.replace("_", " ")}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-slate-300 transition-colors hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <nav className="border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-0 px-4">
          {NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin).map((group) =>
            group.href ? (
              <Link
                key={group.label}
                href={group.href}
                className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  pathname === group.href
                    ? "border-[#d97706] text-[#1a365d]"
                    : "border-transparent text-[#64748b] hover:border-[#cbd5e1] hover:text-[#1e293b]"
                }`}
              >
                {group.label}
              </Link>
            ) : (
              <NavDropdown
                key={group.label}
                group={group}
                pathname={pathname}
                isAdmin={isAdmin}
              />
            )
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {children || (
          <>
            <h2 className="text-xl font-bold uppercase tracking-wide text-[#1e293b]">Dashboard</h2>
            <p className="mt-2 text-sm text-[#64748b]">
              Welcome back, {user.displayName}. Your rental management workspace is ready.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Properties", href: "/dashboard/properties", description: "Manage property portfolio" },
                { label: "Units", href: "/dashboard/units", description: "Manage individual units" },
                { label: "Contacts", href: "/dashboard/contacts", description: "Tenants and guests" },
                { label: "Leases", href: "/dashboard/leases", description: "Long-term rentals" },
                { label: "Bookings", href: "/dashboard/bookings", description: "Short-term stays" },
                { label: "Payments", href: "/dashboard/payments", description: "Payment tracking" },
                { label: "Invoices", href: "/dashboard/invoices", description: "Invoice management" },
                { label: "Expenses", href: "/dashboard/expenses", description: "Expense management" },
                { label: "Maintenance", href: "/dashboard/maintenance", description: "Work orders & tickets" },
                { label: "Reports", href: "/dashboard/reports", description: "Financial reports" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="border border-[#e2e8f0] bg-white p-6 shadow-sm transition-colors hover:border-[#d97706]"
                >
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[#1e293b]">{item.label}</h3>
                  <p className="mt-1 text-xs text-[#64748b]">{item.description}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
