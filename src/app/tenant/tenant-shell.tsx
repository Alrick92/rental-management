"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface TenantShellProps {
  user: {
    displayName: string;
    email: string;
    role: string;
  };
  children?: React.ReactNode;
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/tenant" },
  { label: "Lease", href: "/tenant/lease" },
  { label: "Payments", href: "/tenant/payments" },
  { label: "Maintenance", href: "/tenant/maintenance" },
  { label: "Messages", href: "/tenant/messages" },
  { label: "Announcements", href: "/tenant/announcements" },
  { label: "Documents", href: "/tenant/documents" },
];

export function TenantShell({ user, children }: TenantShellProps) {
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
          <h1 className="text-lg font-bold tracking-tight text-white">TENANT PORTAL</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300">
              {user.displayName}
              <span className="ml-2 border border-[#047857] bg-[#047857]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#10b981]">
                Tenant
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

      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
