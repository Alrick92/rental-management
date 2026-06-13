"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface MaintenanceShellProps {
  user: {
    displayName: string;
    email: string;
    role: string;
  };
  children?: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "Work Orders", href: "/maintenance" },
  { label: "Time & Costs", href: "/maintenance/costs" },
];

export function MaintenanceShell({ user, children }: MaintenanceShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const roleLabel = user.role === "vendor" ? "Vendor" : "Staff";

  async function handleLogout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-gray-900">Maintenance Portal</h1>
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
              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                {roleLabel}
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

      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
