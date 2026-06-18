// ============================================================================
// lib/google-oauth.ts — Flux OAuth Google (Meet) + getter de jeton (J42)
// ============================================================================
// SERVER-ONLY. Importe lib/crypto/org-secrets (node:crypto) → ne JAMAIS importer
// depuis un composant `"use client"`.
//
// Modèle calqué sur lib/hubspot-oauth.ts (J38). Le client clique « Connecter
// Google Meet » → autorise → Google renvoie un access_token court (~1h) + un
// refresh_token longue durée. On les stocke chiffrés et on rafraîchit l'access
// tout seul. On lit ensuite les transcriptions natives de Meet (lib/google-meet.ts).
//
// Endpoints Google (doc officielle, juin 2026) :
//   - autorisation : https://accounts.google.com/o/oauth2/v2/auth
//   - jeton         : POST https://oauth2.googleapis.com/token (form-urlencoded)
//   - userinfo      : GET  https://www.googleapis.com/oauth2/v2/userinfo
//
// ⚠️ Deux différences Google vs HubSpot :
//   1. Le refresh_token n'est renvoyé QU'À la 1re autorisation → on exige
//      access_type=offline & prompt=consent à l'URL d'autorisation.
//   2. Le grant `refresh_token` NE renvoie PAS de nouveau refresh_token →
//      storeTokens conserve l'ancien quand la réponse n'en contient pas.
//
// Sécurité : on ne logge JAMAIS les jetons ni le client_secret.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret } from "@/lib/crypto/org-secrets";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// Scopes demandés à l'install.
//   - openid + email : identifier le compte connecté (affichage).
//   - meetings.space.readonly : lire conferenceRecords + transcripts + entries
//     (suffit ; on ne touche pas à Drive puisqu'on lit la transcription native,
//      pas la vidéo).
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/meetings.space.readonly",
];

// Marge de sécurité : on considère l'access_token expiré un peu avant l'heure
// réelle, pour éviter d'envoyer un jeton qui meurt en plein vol.
const EXPIRY_MARGIN_MS = 60_000;

export type GoogleTokens = {
  accessToken: string;
  // Absent lors d'un rafraîchissement (Google ne le renvoie qu'à la 1re autorisation).
  refreshToken: string | null;
  expiresInSec: number;
};

// Client admin (service key, bypass RLS) — colonnes secrètes jamais lisibles
// côté client RLS (issue #5). Même pattern que lib/hubspot-oauth.ts.
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
}

function clientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID manquante (OAuth Google).");
  return id;
}

function clientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET manquante (OAuth Google).");
  return secret;
}

// Adresse de redirection après autorisation. DOIT figurer à l'identique dans les
// « URI de redirection autorisés » de l'ID client OAuth Google ET être la même à
// l'autorisation et à l'échange du code.
// Base : GOOGLE_REDIRECT_BASE_URL si défini (local : force localhost sans toucher
// à NEXT_PUBLIC_APP_URL qui pointe la prod), sinon NEXT_PUBLIC_APP_URL.
export function getGoogleRedirectUri(): string {
  const base = (
    process.env.GOOGLE_REDIRECT_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ""
  ).replace(/\/$/, "");
  return `${base}/api/google/oauth/callback`;
}

// ----------------------------------------------------------------------------
// 1. URL d'autorisation. `state` = jeton anti-CSRF (cookie httpOnly côté /start).
//    access_type=offline + prompt=consent → garantit un refresh_token même si le
//    user a déjà autorisé l'app par le passé (sinon Google ne le renvoie pas).
// ----------------------------------------------------------------------------
export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ----------------------------------------------------------------------------
// 2/3. Appel commun au endpoint /token (échange code OU rafraîchissement).
//    Renvoie null si échec (jamais throw — on dégrade côté appelant).
// ----------------------------------------------------------------------------
async function postToken(body: Record<string, string>): Promise<GoogleTokens | null> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[google-oauth] token endpoint non-ok", {
        status: res.status,
        grant: body.grant_type,
      });
      return null;
    }
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) return null;
    return {
      accessToken: json.access_token,
      // Peut être absent sur un refresh : on le remonte en null, storeTokens
      // conserve alors l'ancien.
      refreshToken: json.refresh_token ?? null,
      expiresInSec: json.expires_in ?? 3600,
    };
  } catch (err) {
    console.error("[google-oauth] token request threw", {
      grant: body.grant_type,
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

// Échange le `code` reçu au callback contre des jetons (1re connexion).
export function exchangeCodeForTokens(code: string): Promise<GoogleTokens | null> {
  return postToken({
    grant_type: "authorization_code",
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: getGoogleRedirectUri(),
    code,
  });
}

// Échange le refresh_token contre un nouvel access_token (renouvellement).
export function refreshAccessToken(refreshToken: string): Promise<GoogleTokens | null> {
  return postToken({
    grant_type: "refresh_token",
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
  });
}

// ----------------------------------------------------------------------------
// 4. Persistance chiffrée des jetons + échéance. On ne réécrit le refresh_token
//    QUE s'il est présent dans la réponse (Google ne le renvoie qu'à la 1re
//    autorisation) → sinon on garderait null et casserait les refresh suivants.
// ----------------------------------------------------------------------------
export async function storeTokens(orgId: string, tokens: GoogleTokens): Promise<void> {
  const expiresAt = new Date(
    Date.now() + tokens.expiresInSec * 1000 - EXPIRY_MARGIN_MS,
  ).toISOString();
  const update: Record<string, string> = {
    google_access_token: encryptSecret(tokens.accessToken),
    google_token_expires_at: expiresAt,
  };
  if (tokens.refreshToken) {
    update.google_refresh_token = encryptSecret(tokens.refreshToken);
  }
  const { error } = await admin()
    .from("organizations")
    .update(update)
    .eq("id", orgId);
  if (error) {
    console.error("[google-oauth] storeTokens failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error("Impossible d'enregistrer les jetons Google.");
  }
}

// Stocke l'email du compte connecté (affichage « Connecté en tant que … »).
export async function storeGoogleEmail(orgId: string, email: string | null): Promise<void> {
  await admin()
    .from("organizations")
    .update({ google_email: email })
    .eq("id", orgId);
}

// Efface les jetons OAuth Google (bouton « Déconnecter »).
export async function clearGoogleOAuth(orgId: string): Promise<void> {
  await admin()
    .from("organizations")
    .update({
      google_access_token: null,
      google_refresh_token: null,
      google_token_expires_at: null,
      google_email: null,
    })
    .eq("id", orgId);
}

// ----------------------------------------------------------------------------
// 5. LE getter unifié. Tous les appelants Google passent par ici.
//   1) access_token valide → on le renvoie ;
//   2) expiré + refresh présent → on rafraîchit, on re-stocke, on renvoie ;
//   3) sinon → null (l'appelant dégrade).
// Pas de repli legacy (contrairement à HubSpot : Google n'a jamais eu de mode
// « token collé à la main »).
// ----------------------------------------------------------------------------
export async function getGoogleToken(orgId: string): Promise<string | null> {
  if (!orgId) return null;

  const { data: org } = await admin()
    .from("organizations")
    .select(
      "google_access_token, google_refresh_token, google_token_expires_at",
    )
    .eq("id", orgId)
    .single();

  if (!org) return null;

  const access = decryptSecret(org.google_access_token as string | null);
  const refresh = decryptSecret(org.google_refresh_token as string | null);
  const expiresAt = org.google_token_expires_at as string | null;

  // 1) Access valide
  if (access && expiresAt && new Date(expiresAt).getTime() > Date.now()) {
    return access;
  }

  // 2) Rafraîchissement
  if (refresh) {
    const refreshed = await refreshAccessToken(refresh);
    if (refreshed) {
      await storeTokens(orgId, refreshed);
      return refreshed.accessToken;
    }
  }

  return null;
}

// ----------------------------------------------------------------------------
// 6. Email du compte connecté, depuis l'access_token (sert au callback à
//    remplir google_email sans saisie manuelle).
// ----------------------------------------------------------------------------
export async function getUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { email?: string };
    return json.email ?? null;
  } catch {
    return null;
  }
}

// Indique si une org est connectée à Google (refresh token présent), sans le
// déchiffrer. Utilisé pour le badge « Connecté ».
export function hasOAuthConnection(refreshTokenColumn: string | null | undefined): boolean {
  return Boolean(refreshTokenColumn && refreshTokenColumn.length > 0);
}
