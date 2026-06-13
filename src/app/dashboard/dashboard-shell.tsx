"use client";

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

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Properties", href: "/dashboard/properties" },
  { label: "Units", href: "/dashboard/units" },
  { label: "Contacts", href: "/dashboard/contacts" },
  { label: "Leases", href: "/dashboard/leases" },
  { label: "Bookings", href: "/dashboard/bookings" },
  { label: "Calendar", href: "/dashboard/calendar" },
  { label: "Payments", href: "/dashboard/payments" },
  { label: "Invoices", href: "/dashboard/invoices" },
  { label: "Expenses", href: "/dashboard/expenses" },
  { label: "Maintenance", href: "/dashboard/maintenance" },
  { label: "Documents", href: "/dashboard/documents" },
  { label: "Messages", href: "/dashboard/messages" },
  { label: "Announcements", href: "/dashboard/announcements" },
  { label: "Reports", href: "/dashboard/reports" },
  { label: "Search", href: "/dashboard/search" },
];

const ADMIN_NAV_ITEMS = [
  { label: "Users", href: "/dashboard/users" },
  { label: "Org Settings", href: "/dashboard/org-settings" },
  { label: "Audit Log", href: "/dashboard/audit-log" },
  { label: "GDPR", href: "/dashboard/gdpr" },
];

export function DashboardShell({ user, children }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();

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
        <div className="mx-auto flex max-w-7xl items-center gap-0 px-4 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "border-[#d97706] text-[#1a365d]"
                  : "border-transparent text-[#64748b] hover:border-[#cbd5e1] hover:text-[#1e293b]"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {user.role === "org_admin" && (
            <>
              <span className="mx-2 h-5 w-px bg-[#e2e8f0]" />
              {ADMIN_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "border-[#d97706] text-[#1a365d]"
                      : "border-transparent text-[#d97706] hover:border-[#d97706]/30 hover:text-[#b45309]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </>
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
