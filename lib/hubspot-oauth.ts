// ============================================================================
// lib/hubspot-oauth.ts — Flux OAuth HubSpot (Public App) + getter de jeton (J38)
// ============================================================================
// SERVER-ONLY. Importe lib/crypto/org-secrets (node:crypto) → ne JAMAIS importer
// depuis un composant `"use client"`.
//
// Modèle : on passe du « Private App token » collé à la main (colonne legacy
// `hubspot_token`) à l'OAuth distribuable. Le client clique « Connecter HubSpot »
// → autorise → HubSpot renvoie un access_token court (~30 min) + un refresh_token
// longue durée. On les stocke chiffrés et on rafraîchit l'access_token tout seul.
//
// Endpoints HubSpot (doc officielle, juin 2026) :
//   - autorisation : https://app.hubspot.com/oauth/authorize
//   - jeton         : POST https://api.hubapi.com/oauth/v1/token (form-urlencoded)
//   - info jeton    : GET  https://api.hubapi.com/oauth/v1/access-tokens/{token}
//
// COHABITATION : getHubspotToken() privilégie l'OAuth et retombe sur le legacy
// `hubspot_token` tant qu'une org n'est pas connectée en OAuth → rien ne casse
// pendant la transition. La suppression de la colonne legacy viendra plus tard.
//
// Sécurité : on ne logge JAMAIS les jetons ni le client_secret.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret } from "@/lib/crypto/org-secrets";

const AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const TOKEN_INFO_URL = "https://api.hubapi.com/oauth/v1/access-tokens";

// Scopes demandés à l'install — DOIVENT correspondre à ceux déclarés dans
// hubspot/aloalo-crm-card/src/app/app-hsmeta.json (config.auth.requiredScopes).
const SCOPES = [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.deals.read",
];

// Marge de sécurité : on considère l'access_token expiré un peu avant l'heure
// réelle, pour éviter d'envoyer un jeton qui meurt en plein vol.
const EXPIRY_MARGIN_MS = 60_000;

export type HubspotTokens = {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
};

// ----------------------------------------------------------------------------
// Client admin (service key, bypass RLS) — les colonnes secrètes ne sont jamais
// lisibles côté client RLS (issue #5). Même pattern que lib/hubspot-pipelines.ts.
// ----------------------------------------------------------------------------
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
}

function clientId(): string {
  const id = process.env.HUBSPOT_CLIENT_ID;
  if (!id) throw new Error("HUBSPOT_CLIENT_ID manquante (OAuth HubSpot).");
  return id;
}

function clientSecret(): string {
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!secret) throw new Error("HUBSPOT_CLIENT_SECRET manquante (OAuth HubSpot).");
  return secret;
}

// Adresse de redirection après autorisation. DOIT figurer à l'identique dans les
// redirectUrls de l'app HubSpot (app-hsmeta.json) ET être la même à l'autorisation
// et à l'échange du code.
// Base : HUBSPOT_REDIRECT_BASE_URL si défini (utile en local pour forcer
// http://localhost:3000 sans toucher à NEXT_PUBLIC_APP_URL qui pointe la prod),
// sinon NEXT_PUBLIC_APP_URL.
export function getRedirectUri(): string {
  const base = (
    process.env.HUBSPOT_REDIRECT_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ""
  ).replace(/\/$/, "");
  return `${base}/api/hubspot/oauth/callback`;
}

// ----------------------------------------------------------------------------
// 1. URL d'autorisation — où on envoie l'owner pour qu'il clique « Autoriser ».
// `state` = jeton anti-CSRF (posé en cookie httpOnly côté route start, vérifié
// au callback).
// ----------------------------------------------------------------------------
export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: getRedirectUri(),
    scope: SCOPES.join(" "),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ----------------------------------------------------------------------------
// 2/3. Appel commun au endpoint /token (échange code OU rafraîchissement).
// Body en application/x-www-form-urlencoded. Renvoie null si échec (jamais throw
// pour ne pas casser un appel métier sur un refresh raté → on dégrade).
// ----------------------------------------------------------------------------
async function postToken(body: Record<string, string>): Promise<HubspotTokens | null> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[hubspot-oauth] token endpoint non-ok", {
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
    if (!json.access_token || !json.refresh_token) return null;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresInSec: json.expires_in ?? 1800,
    };
  } catch (err) {
    console.error("[hubspot-oauth] token request threw", {
      grant: body.grant_type,
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

// Échange le `code` reçu au callback contre des jetons (1re connexion).
export function exchangeCodeForTokens(code: string): Promise<HubspotTokens | null> {
  return postToken({
    grant_type: "authorization_code",
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: getRedirectUri(),
    code,
  });
}

// Échange le refresh_token contre un nouvel access_token (renouvellement).
export function refreshAccessToken(refreshToken: string): Promise<HubspotTokens | null> {
  return postToken({
    grant_type: "refresh_token",
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
  });
}

// ----------------------------------------------------------------------------
// 4. Persistance chiffrée des jetons + échéance.
// ----------------------------------------------------------------------------
export async function storeTokens(orgId: string, tokens: HubspotTokens): Promise<void> {
  const expiresAt = new Date(
    Date.now() + tokens.expiresInSec * 1000 - EXPIRY_MARGIN_MS,
  ).toISOString();
  const { error } = await admin()
    .from("organizations")
    .update({
      hubspot_access_token: encryptSecret(tokens.accessToken),
      hubspot_refresh_token: encryptSecret(tokens.refreshToken),
      hubspot_token_expires_at: expiresAt,
    })
    .eq("id", orgId);
  if (error) {
    console.error("[hubspot-oauth] storeTokens failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error("Impossible d'enregistrer les jetons HubSpot.");
  }
}

// Efface les jetons OAuth (bouton « Déconnecter »). Ne touche pas au legacy.
export async function clearHubspotOAuth(orgId: string): Promise<void> {
  await admin()
    .from("organizations")
    .update({
      hubspot_access_token: null,
      hubspot_refresh_token: null,
      hubspot_token_expires_at: null,
    })
    .eq("id", orgId);
}

// ----------------------------------------------------------------------------
// 5. LE getter unifié. Tous les appelants HubSpot passent par ici.
//   1) access_token OAuth valide → on le renvoie ;
//   2) expiré + refresh présent  → on rafraîchit, on re-stocke, on renvoie ;
//   3) sinon                     → repli sur le legacy hubspot_token (transition).
// Renvoie null si aucune connexion exploitable (l'appelant dégrade déjà).
// ----------------------------------------------------------------------------
export async function getHubspotToken(orgId: string): Promise<string | null> {
  if (!orgId) return null;

  const { data: org } = await admin()
    .from("organizations")
    .select(
      "hubspot_access_token, hubspot_refresh_token, hubspot_token_expires_at, hubspot_token",
    )
    .eq("id", orgId)
    .single();

  if (!org) return null;

  const access = decryptSecret(org.hubspot_access_token as string | null);
  const refresh = decryptSecret(org.hubspot_refresh_token as string | null);
  const expiresAt = org.hubspot_token_expires_at as string | null;

  // 1) Access valide
  if (access && expiresAt && new Date(expiresAt).getTime() > Date.now()) {
    return access;
  }

  // 2) Rafraîchissement
  if (refresh) {
    const refreshed = await refreshAccessToken(refresh);
    if (refreshed) {
      // HubSpot renvoie parfois le même refresh_token : storeTokens le ré-écrit,
      // sans conséquence.
      await storeTokens(orgId, refreshed);
      return refreshed.accessToken;
    }
    // Refresh raté (token révoqué côté HubSpot, réseau…) : on tente quand même
    // le repli legacy ci-dessous plutôt que d'échouer sec.
  }

  // 3) Repli legacy (Private App token collé à la main, pré-OAuth)
  return decryptSecret(org.hubspot_token as string | null);
}

// ----------------------------------------------------------------------------
// 6. Info jeton : récupère le hub_id (= portal id) et les scopes accordés, sans
// saisie manuelle. Sert au callback pour remplir hubspot_portal_id.
// ----------------------------------------------------------------------------
export async function getTokenInfo(
  accessToken: string,
): Promise<{ hubId: string | null; scopes: string[] } | null> {
  try {
    const res = await fetch(`${TOKEN_INFO_URL}/${accessToken}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { hub_id?: number; scopes?: string[] };
    return {
      hubId: json.hub_id != null ? String(json.hub_id) : null,
      scopes: json.scopes ?? [],
    };
  } catch {
    return null;
  }
}

// Indique si une org est connectée en OAuth (refresh token présent), sans le
// déchiffrer. Utilisé pour le badge « Connecté ».
export function hasOAuthConnection(refreshTokenColumn: string | null | undefined): boolean {
  return Boolean(refreshTokenColumn && refreshTokenColumn.length > 0);
}
