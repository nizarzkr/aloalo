// ============================================================================
// /dashboard/team — gestion d'équipe (J8 étape 4)
// ============================================================================
// Server Component : on charge en parallèle les membres actifs, les invitations
// pending et le profil courant pour piloter le bouton "Inviter".
// ============================================================================

import { redirect } from "next/navigation";

import { TeamView } from "@/components/dashboard/team-view";
import { createClient } from "@/lib/supabase/server";

export default async function TeamPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Profil courant — on a besoin de role + org pour filtrer la suite.
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single();

  if (!currentProfile?.organization_id) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        <p className="text-sm text-muted-foreground">
          Impossible de charger votre organisation.
        </p>
      </div>
    );
  }

  const orgId = currentProfile.organization_id;
  const nowIso = new Date().toISOString();

  const [membersRes, pendingRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, email, role, created_at, expires_at")
      .eq("organization_id", orgId)
      .is("accepted_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <TeamView
      members={membersRes.data ?? []}
      pending={pendingRes.data ?? []}
      isOwner={currentProfile.role === "owner"}
      currentUserId={user.id}
    />
  );
}
