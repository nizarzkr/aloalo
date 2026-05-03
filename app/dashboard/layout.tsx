import { redirect } from "next/navigation";

import { Sidebar } from "@/components/dashboard/sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Le proxy bloque déjà l'accès non-auth, mais on garde la ceinture-bretelles
  // pour satisfaire TypeScript et couvrir un éventuel décalage de cache.
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, organizations ( name )")
    .eq("id", user.id)
    .single();

  // Embed Supabase d'une FK : la relation est typée comme objet ou tableau
  // selon la cardinalité détectée — on normalise en lecture.
  const organization = Array.isArray(profile?.organizations)
    ? profile?.organizations[0]
    : profile?.organizations;

  return (
    <div className="flex min-h-screen flex-1">
      <Sidebar
        fullName={profile?.full_name ?? ""}
        organizationName={organization?.name ?? ""}
        email={profile?.email ?? user.email ?? ""}
      />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
