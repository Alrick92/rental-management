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
  { label: "Work Orders", href: "/maintenance", icon: "📋" },
  { label: "Time & Costs", href: "/maintenance/costs", icon: "💰" },
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
      {/* Top nav - simplified on mobile */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 md:px-4 md:py-3">
          <div className="flex items-center gap-3 md:gap-6">
            <h1 className="text-base md:text-lg font-semibold text-gray-900">
              <span className="hidden md:inline">Maintenance Portal</span>
              <span className="md:hidden">Maintenance</span>
            </h1>
            {/* Desktop nav links */}
            <div className="hidden md:flex gap-1">
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
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-xs md:text-sm text-gray-600">
              <span className="hidden md:inline">{user.displayName} </span>
              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                {roleLabel}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm text-gray-600 hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-3 py-4 md:px-4 md:py-8 pb-20 md:pb-8">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white safe-area-bottom">
        <div className="flex justify-around py-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 min-w-[64px] ${
                pathname === item.href
                  ? "text-indigo-600"
                  : "text-gray-400"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
