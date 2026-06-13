import { getAdminSession } from "@/lib/auth";
import { AdminShell } from "./admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  // No session = login page (or redirected to login) — render without shell
  if (!session) {
    return <>{children}</>;
  }

  return (
    <AdminShell
      user={{
        displayName: session.displayName,
        email: session.email,
        role: "super_admin",
      }}
    >
      {children}
    </AdminShell>
  );
}
