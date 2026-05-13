"use server";

// ============================================================================
// Server Actions de /dashboard/settings
// ============================================================================
// On suit le pattern déjà en place dans le repo (cf. app/api/invitations) :
//   1. Vérification de la session via le client Supabase « user » (cookies)
//   2. Lecture du profile (owner check) via l'admin client pour éviter les
//      surprises RLS
//   3. Écriture via l'admin client (bypass RLS, plus simple que d'ajouter une
//      policy UPDATE sur organizations juste pour ce flow)
// ============================================================================

import { revalidatePath } from "next/cache";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { OrgUpdateSchema, RingoverApiKeySchema } from "@/lib/validations";

// Type de retour homogène : on évite redirect() pour pouvoir afficher
// un message inline dans le formulaire (success/error).
export type UpdateOrgResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
}

// Concatène les messages Zod en une phrase lisible (UI form, pas API).
function firstZodMessage(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Données invalides.";
}

export async function updateOrganization(
  _prev: UpdateOrgResult | null,
  formData: FormData,
): Promise<UpdateOrgResult> {
  // Validation Zod : name obligatoire, logo_url http(s) ou vide → null en DB.
  const parsed = OrgUpdateSchema.safeParse({
    name: formData.get("name"),
    logo_url: formData.get("logo_url"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error.issues) };
  }
  const { name, logo_url } = parsed.data;

  // 1. Session — on s'assure que le user est bien connecté.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Session expirée. Reconnectez-vous." };
  }

  // 2. Profil + check owner. Admin client pour éviter qu'une RLS exotique
  //    renvoie 0 ligne et nous fasse croire à un user sans org.
  const admin = getAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return { ok: false, error: "Profil introuvable." };
  }
  if (profile.role !== "owner") {
    return {
      ok: false,
      error: "Seul le propriétaire de l'organisation peut modifier ces informations.",
    };
  }

  // 3. Update — on update uniquement les champs concernés.
  const { error: updateError } = await admin
    .from("organizations")
    .update({ name, logo_url })
    .eq("id", profile.organization_id);

  if (updateError) {
    console.error("settings.updateOrganization failed", updateError);
    return { ok: false, error: "Impossible d'enregistrer pour le moment." };
  }

  // 4. Rafraîchit la sidebar (qui affiche le nom de l'org) et la page.
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");

  return { ok: true, message: "Modifications enregistrées." };
}

// ============================================================================
// updateRingoverApiKey — stocke la clé API Ringover du client (owner only)
// ============================================================================
// Sécurité : on ne renvoie JAMAIS la clé en clair (ni dans le retour, ni dans
// les logs). Le formulaire affiche un input password vide à chaque rendu —
// l'utilisateur retape sa clé s'il veut la modifier, sinon il laisse vide
// (et on n'écrase pas la valeur existante).
//
// Champ form attendu : "ringover_api_key" (string).
// Valeur vide = no-op (pas d'erreur, mais pas d'écriture non plus).
// ============================================================================
export async function updateRingoverApiKey(
  _prev: UpdateOrgResult | null,
  formData: FormData,
): Promise<UpdateOrgResult> {
  // Cas 1 — champ laissé vide : succès silencieux (l'utilisateur ne veut
  // pas modifier la clé existante). On court-circuite AVANT Zod, qui
  // rejetterait avec "clé API requise".
  const rawKey = String(formData.get("ringover_api_key") ?? "").trim();
  if (rawKey.length === 0) {
    return { ok: true, message: "Aucune modification (champ vide)." };
  }

  // Validation Zod : non vide, max 200 chars, pas d'espaces internes.
  const parsed = RingoverApiKeySchema.safeParse({ ringover_api_key: rawKey });
  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error.issues) };
  }
  const key = parsed.data.ringover_api_key;

  // 1. Session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Session expirée. Reconnectez-vous." };
  }

  // 2. Profil + owner check (même pattern que updateOrganization)
  const admin = getAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return { ok: false, error: "Profil introuvable." };
  }
  if (profile.role !== "owner") {
    return {
      ok: false,
      error: "Seul le propriétaire de l'organisation peut modifier la clé API.",
    };
  }

  // 3. Update — on n'inclut JAMAIS la clé dans un log d'erreur structuré.
  const { error: updateError } = await admin
    .from("organizations")
    .update({ ringover_api_key: key })
    .eq("id", profile.organization_id);

  if (updateError) {
    // On log uniquement le code/erreur Supabase, surtout pas la valeur.
    console.error("settings.updateRingoverApiKey failed", {
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "Impossible d'enregistrer la clé pour le moment." };
  }

  revalidatePath("/dashboard/settings");

  return { ok: true, message: "Clé API Ringover enregistrée." };
}

