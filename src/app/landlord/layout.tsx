import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LandlordShell } from "./landlord-shell";

export default async function LandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "landlord") {
    redirect("/login");
  }

  return (
    <LandlordShell
      user={{
        displayName: session.displayName,
        email: session.email,
        role: session.role,
      }}
    >
      {children}
    </LandlordShell>
  );
}
