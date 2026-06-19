// ============================================================================
// lib/pipedrive-oauth.ts — Flux OAuth Pipedrive + getter de contexte API (J46)
// ============================================================================
// SERVER-ONLY. Importe lib/crypto/org-secrets (node:crypto) → ne JAMAIS importer
// depuis un composant `"use client"`.
//
// Modèle calqué sur lib/hubspot-oauth.ts (J38) : le client clique « Connecter
// Pipedrive » → autorise → Pipedrive renvoie un access_token court (~1 h) + un
// refresh_token (60 j). On les stocke chiffrés et on rafraîchit tout seul.
//
// Endpoints Pipedrive (doc officielle, juin 2026) :
//   - autorisation : GET  https://oauth.pipedrive.com/oauth/authorize
//   - jeton        : POST https://oauth.pipedrive.com/oauth/token
//        → AUTH BASIC : header Authorization: Basic base64(client_id:client_secret)
//        → corps x-www-form-urlencoded (grant_type, code/refresh_token, redirect_uri)
//
// ⚠️ DEUX différences vs HubSpot :
//   1. La réponse /token contient `api_domain` = base d'URL PROPRE À LA SOCIÉTÉ
//      (ex. https://acme.pipedrive.com) sur laquelle TOUS les appels API partent.
//      → getPipedriveContext renvoie le COUPLE { token, apiDomain }.
//   2. Le grant refresh_token RENVOIE un NOUVEAU refresh_token (rotation) → on le
//      réécrit systématiquement (≠ Google qui ne le renvoie pas).
//
// Sécurité : on ne logge JAMAIS les jetons ni le client_secret.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret } from "@/lib/crypto/org-secrets";

const AUTHORIZE_URL = "https://oauth.pipedrive.com/oauth/authorize";
const TOKEN_URL = "https://oauth.pipedrive.com/oauth/token";

// Scopes demandés à l'install — DOIVENT correspondre à ceux déclarés dans l'app
// Pipedrive (Developer Hub). `*:full` = lecture + écriture (notes, tâches, sync).
const SCOPES = ["base", "deals:full", "contacts:full", "activities:full"];

// Marge de sécurité : on considère l'access_token expiré un peu avant l'heure
// réelle, pour éviter d'envoyer un jeton qui meurt en plein vol.
const EXPIRY_MARGIN_MS = 60_000;

export type PipedriveTokens = {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  apiDomain: string;
};

// Contexte minimal pour taper l'API : jeton + base d'URL de la société.
export type PipedriveContext = {
  token: string;
  apiDomain: string;
};

// ----------------------------------------------------------------------------
// Client admin (service key, bypass RLS) — les colonnes secrètes ne sont jamais
// lisibles côté client RLS (issue #5). Même pattern que lib/hubspot-oauth.ts.
// ----------------------------------------------------------------------------
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
}

function clientId(): string {
  const id = process.env.PIPEDRIVE_CLIENT_ID;
  if (!id) throw new Error("PIPEDRIVE_CLIENT_ID manquante (OAuth Pipedrive).");
  return id;
}

function clientSecret(): string {
  const secret = process.env.PIPEDRIVE_CLIENT_SECRET;
  if (!secret)
    throw new Error("PIPEDRIVE_CLIENT_SECRET manquante (OAuth Pipedrive).");
  return secret;
}

// Adresse de redirection après autorisation. DOIT figurer à l'identique dans les
// « Callback URL » de l'app Pipedrive ET être la même à l'autorisation et à
// l'échange du code. Base : PIPEDRIVE_REDIRECT_BASE_URL si défini (local), sinon
// NEXT_PUBLIC_APP_URL (prod). Même logique que getRedirectUri() HubSpot.
export function getRedirectUri(): string {
  const base = (
    process.env.PIPEDRIVE_REDIRECT_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ""
  ).replace(/\/$/, "");
  return `${base}/api/pipedrive/oauth/callback`;
}

// ----------------------------------------------------------------------------
// 1. URL d'autorisation — où on envoie l'owner pour qu'il clique « Autoriser ».
// `state` = jeton anti-CSRF (posé en cookie httpOnly côté route start).
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
// AUTH BASIC + corps x-www-form-urlencoded. Renvoie null si échec (jamais throw
// pour ne pas casser un appel métier sur un refresh raté → on dégrade).
// ----------------------------------------------------------------------------
async function postToken(
  body: Record<string, string>,
): Promise<PipedriveTokens | null> {
  const basic = Buffer.from(`${clientId()}:${clientSecret()}`).toString(
    "base64",
  );
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[pipedrive-oauth] token endpoint non-ok", {
        status: res.status,
        grant: body.grant_type,
      });
      return null;
    }
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      api_domain?: string;
    };
    if (!json.access_token || !json.refresh_token || !json.api_domain)
      return null;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresInSec: json.expires_in ?? 3600,
      apiDomain: json.api_domain.replace(/\/$/, ""),
    };
  } catch (err) {
    console.error("[pipedrive-oauth] token request threw", {
      grant: body.grant_type,
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

// Échange le `code` reçu au callback contre des jetons (1re connexion).
export function exchangeCodeForTokens(
  code: string,
): Promise<PipedriveTokens | null> {
  return postToken({
    grant_type: "authorization_code",
    redirect_uri: getRedirectUri(),
    code,
  });
}

// Échange le refresh_token contre un nouvel access_token (renouvellement).
// NB : Pipedrive renvoie aussi un NOUVEAU refresh_token (rotation) ET l'api_domain.
export function refreshAccessToken(
  refreshToken: string,
): Promise<PipedriveTokens | null> {
  return postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

// ----------------------------------------------------------------------------
// 4. Persistance chiffrée des jetons + échéance + api_domain.
// ----------------------------------------------------------------------------
export async function storeTokens(
  orgId: string,
  tokens: PipedriveTokens,
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + tokens.expiresInSec * 1000 - EXPIRY_MARGIN_MS,
  ).toISOString();
  const { error } = await admin()
    .from("organizations")
    .update({
      pipedrive_access_token: encryptSecret(tokens.accessToken),
      pipedrive_refresh_token: encryptSecret(tokens.refreshToken),
      pipedrive_token_expires_at: expiresAt,
      pipedrive_api_domain: tokens.apiDomain,
    })
    .eq("id", orgId);
  if (error) {
    console.error("[pipedrive-oauth] storeTokens failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error("Impossible d'enregistrer les jetons Pipedrive.");
  }
}

// Efface les jetons OAuth (bouton « Déconnecter »). Le reset de crm_provider est
// géré par l'appelant (disconnectPipedrive), pas ici.
export async function clearPipedriveOAuth(orgId: string): Promise<void> {
  await admin()
    .from("organizations")
    .update({
      pipedrive_access_token: null,
      pipedrive_refresh_token: null,
      pipedrive_token_expires_at: null,
      pipedrive_api_domain: null,
      pipedrive_company_id: null,
    })
    .eq("id", orgId);
}

// ----------------------------------------------------------------------------
// 5. LE getter unifié. Tous les appelants API Pipedrive passent par ici.
//   1) access_token valide + api_domain → on renvoie le couple ;
//   2) expiré + refresh présent          → on rafraîchit, re-stocke, on renvoie ;
//   3) sinon                             → null (l'appelant dégrade déjà).
// Renvoie le COUPLE { token, apiDomain } car les appels API ont besoin des deux.
// ----------------------------------------------------------------------------
export async function getPipedriveContext(
  orgId: string,
): Promise<PipedriveContext | null> {
  if (!orgId) return null;

  const { data: org } = await admin()
    .from("organizations")
    .select(
      "pipedrive_access_token, pipedrive_refresh_token, pipedrive_token_expires_at, pipedrive_api_domain",
    )
    .eq("id", orgId)
    .single();

  if (!org) return null;

  const access = decryptSecret(org.pipedrive_access_token as string | null);
  const refresh = decryptSecret(org.pipedrive_refresh_token as string | null);
  const expiresAt = org.pipedrive_token_expires_at as string | null;
  const apiDomain = org.pipedrive_api_domain as string | null;

  // 1) Access valide (token + api_domain présents et non expiré)
  if (
    access &&
    apiDomain &&
    expiresAt &&
    new Date(expiresAt).getTime() > Date.now()
  ) {
    return { token: access, apiDomain };
  }

  // 2) Rafraîchissement
  if (refresh) {
    const refreshed = await refreshAccessToken(refresh);
    if (refreshed) {
      await storeTokens(orgId, refreshed);
      return { token: refreshed.accessToken, apiDomain: refreshed.apiDomain };
    }
  }

  // 3) Pas de connexion exploitable.
  return null;
}

// Indique si une org est connectée à Pipedrive (refresh token présent), sans le
// déchiffrer. Utilisé pour le badge « Connecté » (page Intégrations).
export function hasPipedriveConnection(
  refreshTokenColumn: string | null | undefined,
): boolean {
  return Boolean(refreshTokenColumn && refreshTokenColumn.length > 0);
}
