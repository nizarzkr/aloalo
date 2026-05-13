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

// Type de retour homogène : on évite redirect() pour pouvoir afficher
// un message inline dans le formulaire (success/error).
export type UpdateOrgResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

// Garde-fous côté serveur — la même URL passe aussi par le navigateur côté
// rendu, mais on ne fait JAMAIS confiance au client.
const MAX_NAME_LENGTH = 120;
const MAX_URL_LENGTH = 500;
const MAX_RINGOVER_KEY_LENGTH = 200;

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
}

// Validation d'URL minimaliste : on accepte http/https uniquement, vide = on
// efface le logo. Renvoie la valeur normalisée ou null si vide.
function normalizeLogoUrl(raw: string): { value: string | null } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null };
  if (trimmed.length > MAX_URL_LENGTH) {
    return { error: `L'URL du logo dépasse ${MAX_URL_LENGTH} caractères.` };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { error: "L'URL du logo doit commencer par https:// (ou http://)." };
    }
    return { value: parsed.toString() };
  } catch {
    return { error: "L'URL du logo n'est pas valide." };
  }
}

export async function updateOrganization(
  _prev: UpdateOrgResult | null,
  formData: FormData,
): Promise<UpdateOrgResult> {
  const name = String(formData.get("name") ?? "").trim();
  const logoUrlRaw = String(formData.get("logo_url") ?? "");

  if (name.length === 0) {
    return { ok: false, error: "Le nom de l'organisation est obligatoire." };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      error: `Le nom dépasse ${MAX_NAME_LENGTH} caractères.`,
    };
  }

  const logoCheck = normalizeLogoUrl(logoUrlRaw);
  if ("error" in logoCheck) {
    return { ok: false, error: logoCheck.error };
  }

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
    .update({ name, logo_url: logoCheck.value })
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
  const key = String(formData.get("ringover_api_key") ?? "").trim();

  // Cas 1 — champ laissé vide : on considère que l'utilisateur ne souhaite
  // pas modifier la clé existante. On retourne un succès silencieux pour
  // éviter de polluer l'UI avec une erreur "champ requis".
  if (key.length === 0) {
    return { ok: true, message: "Aucune modification (champ vide)." };
  }

  if (key.length > MAX_RINGOVER_KEY_LENGTH) {
    return {
      ok: false,
      error: `La clé dépasse ${MAX_RINGOVER_KEY_LENGTH} caractères.`,
    };
  }

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

