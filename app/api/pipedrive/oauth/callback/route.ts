// ============================================================================
// GET /api/pipedrive/oauth/callback — retour d'autorisation OAuth Pipedrive (J46)
// ============================================================================
// Pipedrive redirige ici avec ?code&state (ou ?error si refus). On :
//   1. vérifie le `state` vs le cookie posé par /start (anti-CSRF) ;
//   2. ré-dérive l'org depuis la SESSION (jamais un orgId d'URL) ;
//   3. échange le code contre des jetons (+ api_domain) → stockage chiffré ;
//   4. POSE crm_provider='pipedrive' (l'org pilote désormais Pipedrive) ;
//   5. synchronise le tunnel (best-effort) et redirige avec un statut lisible.
//
// Miroir strict de /api/hubspot/oauth/callback (J38). Toute erreur dégrade vers
// une redirection ?pipedrive=error (jamais de 500 brut).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, storeTokens } from "@/lib/pipedrive-oauth";
import { getPipelinesAndStages } from "@/lib/pipedrive";
import { persistOrgPipelines } from "@/lib/hubspot-pipelines";

const SETTINGS_PATH = "/dashboard/settings/integrations";

function redirectTo(req: NextRequest, status: string): NextResponse {
  const returnCookie = req.cookies.get("pipedrive_oauth_return")?.value;
  const dest = returnCookie === "/onboarding" ? "/onboarding" : SETTINGS_PATH;
  const url = new URL(dest, req.url);
  url.searchParams.set("pipedrive", status);
  const res = NextResponse.redirect(url);
  // On nettoie les cookies du flux dans tous les cas.
  res.cookies.set("pipedrive_oauth_state", "", { path: "/", maxAge: 0 });
  res.cookies.set("pipedrive_oauth_return", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) return redirectTo(req, "denied");

  // 1. Vérif state anti-CSRF
  const cookieState = req.cookies.get("pipedrive_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectTo(req, "error");
  }

  // 2. Org depuis la session (jamais un identifiant venu de l'URL).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirectTo(req, "error");

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

  const orgId = profile?.organization_id;
  if (!orgId || profile?.role !== "owner") return redirectTo(req, "error");

  try {
    // 3. Échange code → jetons (+ api_domain) + stockage chiffré.
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens) return redirectTo(req, "error");
    await storeTokens(orgId, tokens);

    // 4. L'org pilote désormais Pipedrive (getCrmAdapter s'appuie là-dessus).
    await admin
      .from("organizations")
      .update({ crm_provider: "pipedrive" })
      .eq("id", orgId);

    // 5. Sync du tunnel (best-effort : ne casse pas la connexion si échec).
    const pipelines = await getPipelinesAndStages(
      tokens.apiDomain,
      tokens.accessToken,
    );
    await persistOrgPipelines(orgId, pipelines);

    return redirectTo(req, "connected");
  } catch (err) {
    console.error("[pipedrive-oauth] callback failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return redirectTo(req, "error");
  }
}
