import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <>
      <h2 className="text-xl font-bold uppercase tracking-wide text-white">System Overview</h2>
      <p className="mt-2 text-sm text-slate-400">
        Manage organizations, system settings, and monitor the platform.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Organizations", href: "/admin/organizations", description: "Create and manage tenant orgs" },
          { label: "System Settings", href: "/admin/settings", description: "SMTP, backups, app config" },
          { label: "Audit Log", href: "/admin/audit-log", description: "Cross-org activity log" },
          { label: "Impersonation", href: "/admin/impersonation", description: "Enter any org as any user" },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="border border-[#234681] bg-[#1a365d] p-6 transition-colors hover:border-[#d97706]"
          >
            <h3 className="text-sm font-bold uppercase tracking-wide text-white">{item.label}</h3>
            <p className="mt-1 text-xs text-slate-400">{item.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
