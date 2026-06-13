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
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="bg-[#1a365d]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 md:px-4 md:py-3">
          <h1 className="text-base md:text-lg font-bold tracking-tight text-white">
            <span className="hidden md:inline">MAINTENANCE PORTAL</span>
            <span className="md:hidden">MAINTENANCE</span>
          </h1>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-xs md:text-sm text-slate-300">
              <span className="hidden md:inline">{user.displayName} </span>
              <span className="border border-[#d97706] bg-[#d97706]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#d97706]">
                {roleLabel}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm text-slate-300 transition-colors hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <nav className="hidden md:block border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-0 px-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "border-[#d97706] text-[#1a365d]"
                  : "border-transparent text-[#64748b] hover:border-[#cbd5e1] hover:text-[#1e293b]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-3 py-4 md:px-4 md:py-8 pb-20 md:pb-8">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-[#e2e8f0] bg-white safe-area-bottom">
        <div className="flex justify-around py-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 min-w-[64px] ${
                pathname === item.href
                  ? "text-[#1a365d]"
                  : "text-[#94a3b8]"
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
