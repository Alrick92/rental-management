import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MaintenanceShell } from "./maintenance-shell";

export default async function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "maintenance_staff" && session.role !== "vendor") {
    redirect("/login");
  }

  return (
    <MaintenanceShell
      user={{
        displayName: session.displayName,
        email: session.email,
        role: session.role,
      }}
    >
      {children}
    </MaintenanceShell>
  );
}
