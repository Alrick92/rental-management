import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TenantShell } from "./tenant-shell";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "tenant") {
    redirect("/login");
  }

  return (
    <TenantShell
      user={{
        displayName: session.displayName,
        email: session.email,
        role: session.role,
      }}
    >
      {children}
    </TenantShell>
  );
}
