import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/dashboard/sidebar";
import {
  getOnboardingState,
  ONBOARDING_SNOOZE_COOKIE,
} from "@/lib/onboarding";
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
    .select("full_name, email, role, organization_id, organizations ( name )")
    .eq("id", user.id)
    .single();

  // Redirection douce vers l'onboarding (J29) : seul l'OWNER d'une org dont le
  // parcours n'est pas terminé y est renvoyé, sauf s'il a cliqué « passer pour
  // l'instant » (cookie de snooze). Les manager/sales ne sont jamais redirigés.
  if (profile?.role === "owner" && profile.organization_id) {
    const snoozed =
      (await cookies()).get(ONBOARDING_SNOOZE_COOKIE)?.value === "1";
    if (!snoozed) {
      const { completedAt } = await getOnboardingState(profile.organization_id);
      if (!completedAt) redirect("/onboarding");
    }
  }

  // Embed Supabase d'une FK : la relation est typée comme objet ou tableau
  // selon la cardinalité détectée — on normalise en lecture.
  const organization = Array.isArray(profile?.organizations)
    ? profile?.organizations[0]
    : profile?.organizations;

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <Sidebar
        fullName={profile?.full_name ?? ""}
        organizationName={organization?.name ?? ""}
        email={profile?.email ?? user.email ?? ""}
      />
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
