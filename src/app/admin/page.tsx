import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="border-b border-gray-700 bg-gray-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Admin Console</h1>
          <span className="text-sm text-gray-400">
            {session.displayName} (super_admin)
          </span>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="text-xl font-semibold">System Overview</h2>
        <p className="mt-2 text-sm text-gray-400">
          Manage organizations, system settings, and monitor the platform.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Organizations", description: "Create and manage tenant orgs" },
            { label: "System Settings", description: "SMTP, backups, app config" },
            { label: "Audit Log", description: "Cross-org activity log" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-gray-700 bg-gray-800 p-6"
            >
              <h3 className="text-sm font-medium text-white">{item.label}</h3>
              <p className="mt-1 text-xs text-gray-400">{item.description}</p>
              <p className="mt-4 text-xs text-gray-500">Coming in Phase 8</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
