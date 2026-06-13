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
  { label: "Payments", href: "/dashboard/payments" },
  { label: "Expenses", href: "/dashboard/expenses" },
  { label: "Maintenance", href: "/dashboard/maintenance" },
];

export function DashboardShell({ user, children }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-gray-900">Rental Manager</h1>
            <div className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    pathname === item.href
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.displayName}{" "}
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
                {user.role}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {children || (
          <>
            <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
            <p className="mt-2 text-sm text-gray-600">
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
                { label: "Expenses", href: "/dashboard/expenses", description: "Expense management" },
                { label: "Maintenance", href: "/dashboard/maintenance", description: "Work orders & tickets" },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:border-indigo-300 hover:shadow transition"
                >
                  <h3 className="text-sm font-medium text-gray-900">{item.label}</h3>
                  <p className="mt-1 text-xs text-gray-500">{item.description}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
