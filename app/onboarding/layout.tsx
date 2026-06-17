// ============================================================================
// /onboarding — Layout plein écran de l'assistant de configuration (J29)
// ============================================================================
// Parcours dédié, SANS la sidebar du dashboard, pour maximiser l'effet « waouh »
// du premier contact. Calqué sur app/(auth)/layout.tsx (logo centré, fond doux).
//
// Garde d'accès :
//   - non authentifié → /login (ceinture-bretelles, le proxy bloque déjà) ;
//   - non-owner (manager/sales d'une org existante) → /dashboard (les 3 étapes
//     touchent des secrets/config réservés à l'owner) ;
//   - onboarding DÉJÀ terminé → /dashboard (pas de raison de le rejouer).
// ============================================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { getOnboardingState } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner" || !profile.organization_id) {
    redirect("/dashboard");
  }

  const { completedAt } = await getOnboardingState(profile.organization_id);
  if (completedAt) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-muted/30">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="font-heading text-xl font-bold tracking-tight text-foreground">
          Aloalo
        </span>
        <Link
          href="/dashboard"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Quitter
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 pb-16">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}
