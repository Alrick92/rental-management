"use client";

import { useRouter } from "next/navigation";

interface DashboardShellProps {
  user: {
    displayName: string;
    email: string;
    role: string;
  };
}

export function DashboardShell({ user }: DashboardShellProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">Rental Manager</h1>
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
        <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
        <p className="mt-2 text-sm text-gray-600">
          Welcome back, {user.displayName}. Your rental management workspace is ready.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Units", href: "/units", description: "Manage your properties" },
            { label: "Contacts", href: "/contacts", description: "Tenants and guests" },
            { label: "Leases", href: "/leases", description: "Long-term rentals" },
            { label: "Bookings", href: "/bookings", description: "Short-term stays" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-sm font-medium text-gray-900">{item.label}</h3>
              <p className="mt-1 text-xs text-gray-500">{item.description}</p>
              <p className="mt-4 text-xs text-gray-400">Coming in Phase 2+</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
