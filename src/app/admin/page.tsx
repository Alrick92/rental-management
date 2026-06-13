import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const cards = [
    {
      label: "Organizations",
      description: "Create and manage tenant organizations",
      href: "/admin/organizations",
    },
    {
      label: "Impersonation",
      description: "Enter an org as a user for support",
      href: "/admin/impersonation",
    },
    {
      label: "Audit Log",
      description: "Cross-org activity log with filters",
      href: "/admin/audit-log",
    },
    {
      label: "System Settings",
      description: "SMTP, backups, app-wide configuration",
      href: "/admin/settings",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="border-b border-gray-700 bg-gray-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Admin Console</h1>
          <div className="flex items-center gap-4">
            {cards.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="text-sm text-gray-300 hover:text-white"
              >
                {c.label}
              </Link>
            ))}
            <span className="ml-4 text-sm text-gray-400">
              {session.displayName} (super_admin)
            </span>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="text-xl font-semibold">System Overview</h2>
        <p className="mt-2 text-sm text-gray-400">
          Manage organizations, impersonate users, view audit logs, and
          configure system settings.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-lg border border-gray-700 bg-gray-800 p-6 hover:border-indigo-500 transition-colors"
            >
              <h3 className="text-sm font-medium text-white">{item.label}</h3>
              <p className="mt-1 text-xs text-gray-400">{item.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
