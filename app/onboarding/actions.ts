"use server";

// ============================================================================
// Server Actions du parcours d'onboarding (J29)
// ============================================================================
// Deux actions seulement — la connexion téléphonie/HubSpot et la génération des
// critères réutilisent les actions existantes (updateRingoverApiKey,
// updateHubspotSettings, generateExitCriteria de /dashboard/settings/actions).
//
//   - completeOnboarding : l'owner a fini l'assistant → on horodate
//     organizations.onboarding_completed_at (migration 0027) et on efface le
//     cookie de snooze, puis on renvoie au dashboard.
//   - snoozeOnboarding : « passer pour l'instant » → on pose un cookie léger qui
//     suspend la redirection auto (cf. app/dashboard/layout.tsx) ; un bandeau de
//     reprise reste visible sur l'accueil tant que l'onboarding n'est pas terminé.
//
// Même pattern d'auth que /dashboard/settings/actions : session via le client
// « user » (cookies), owner check + écriture via l'admin client (bypass RLS).
// ============================================================================

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { ONBOARDING_SNOOZE_COOKIE } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
}

// Auth + owner check partagés. Renvoie l'org de l'owner, ou null si non autorisé.
async function ownerOrgId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await getAdminClient()
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner" || !profile.organization_id) return null;
  return profile.organization_id;
}

/**
 * L'owner a terminé l'assistant : on horodate la complétion et on lève le snooze.
 * Idempotent (un second appel réécrit juste l'horodatage). Redirige vers le
 * dashboard.
 */
export async function completeOnboarding(): Promise<void> {
  const orgId = await ownerOrgId();
  if (orgId) {
    await getAdminClient()
      .from("organizations")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", orgId);

    const cookieStore = await cookies();
    cookieStore.delete(ONBOARDING_SNOOZE_COOKIE);
  }
  redirect("/dashboard");
}

/**
 * « Passer pour l'instant » : suspend la redirection auto via un cookie (7 jours)
 * sans marquer l'onboarding terminé → le bandeau de reprise reste visible.
 */
export async function snoozeOnboarding(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ONBOARDING_SNOOZE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  });
  redirect("/dashboard");
}
