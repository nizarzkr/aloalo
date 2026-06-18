// ============================================================================
// /dashboard/settings/integrations — Ringover + HubSpot
// ============================================================================

import { redirect } from "next/navigation";
import { Cable } from "lucide-react";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { hasSecret } from "@/lib/crypto/org-secrets";
import { getOrgPipelines } from "@/lib/hubspot-pipelines";
import { CopyButton } from "@/components/dashboard/copy-button";
import { HubspotConnection } from "@/components/dashboard/hubspot-connection";
import { HubspotSettingsForm } from "@/components/dashboard/hubspot-settings-form";
import { PipelineRefreshButton } from "@/components/dashboard/pipeline-refresh-button";
import { RingoverKeyForm } from "@/components/dashboard/ringover-key-form";
import { SectionHeading } from "@/components/dashboard/section-heading";
import { TunnelPreview } from "@/components/dashboard/tunnel-preview";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IntegrationsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ hubspot?: string }>;
}) {
  const { hubspot: hubspotStatus } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Lecture via le client admin (clé secrète, bypass RLS) : depuis l'issue #5,
  // les colonnes ringover_api_key / hubspot_token / hubspot_portal_id ne sont
  // PLUS lisibles par le client RLS (navigateur). On ne dérive QUE des booléens
  // de présence + le portal id, jamais une valeur secrète.
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

  const { data: org } = profile?.organization_id
    ? await admin
        .from("organizations")
        .select(
          "ringover_api_key, hubspot_token, hubspot_refresh_token, hubspot_portal_id",
        )
        .eq("id", profile.organization_id)
        .maybeSingle()
    : { data: null };

  const isOwner = profile?.role === "owner";
  // On ne lit que la PRÉSENCE des secrets (chiffrés OU legacy clair), jamais
  // leur valeur — et on ne déchiffre rien ici.
  const hasRingoverKey = hasSecret(org?.ringover_api_key);
  // OAuth (J38) = présence d'un refresh token ; legacy = ancien Private App
  // token collé à la main. « Connecté » dès que l'un des deux existe.
  const hasHubspotOAuth = hasSecret(org?.hubspot_refresh_token);
  const hasHubspotLegacy = hasSecret(org?.hubspot_token);
  const hasHubspotToken = hasHubspotOAuth || hasHubspotLegacy;
  const hubspotPortalId = org?.hubspot_portal_id ?? "";

  // Carte du tunnel HubSpot (J27) — affichée si HubSpot est connecté.
  const { pipelines, syncedAt } =
    isOwner && profile?.organization_id && hasHubspotToken
      ? await getOrgPipelines(profile.organization_id)
      : { pipelines: [], syncedAt: null };

  // URL du webhook Ringover — basée sur NEXT_PUBLIC_APP_URL (prod/preview).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  const webhookUrl = `${appUrl}/api/webhooks/ringover`;

  return (
    <div>
      <SectionHeading
        icon={Cable}
        title="Intégrations"
        description="Connectez votre téléphonie et votre CRM à Aloalo."
      />

      <div className="space-y-6">
        {/* --- Ringover ----------------------------------------------- */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Ringover</CardTitle>
                <CardDescription>
                  Synchronisez automatiquement vos appels avec Aloalo.
                </CardDescription>
              </div>
              {hasRingoverKey ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  Connectée
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                >
                  À configurer
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Clé API Ringover */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Clé API Ringover</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Permet à Aloalo de récupérer l&apos;enregistrement audio de
                  chaque appel reçu via le webhook. La clé est stockée chiffrée
                  côté serveur et n&apos;est jamais affichée en clair.
                </p>
              </div>
              <RingoverKeyForm canEdit={isOwner} hasKey={hasRingoverKey} />
            </div>

            {/* URL du webhook */}
            <div className="space-y-2 border-t border-border pt-6">
              <h3 className="text-sm font-medium">URL du webhook</h3>
              <p className="text-xs text-muted-foreground">
                Collez cette URL dans Ringover &rsaquo; Paramètres &rsaquo;
                Webhooks pour déclencher la synchronisation à chaque appel
                terminé.
              </p>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground">
                  {webhookUrl ||
                    "URL non configurée (NEXT_PUBLIC_APP_URL manquant)"}
                </code>
                {webhookUrl ? (
                  <CopyButton value={webhookUrl} label="Copier l'URL" />
                ) : null}
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <p>
                Besoin d&apos;aide pour la configuration côté Ringover ?{" "}
                <a
                  href="mailto:support@aloalo.app?subject=Aide%20configuration%20Ringover"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Contactez notre support
                </a>
                .
              </p>
            </div>
          </CardContent>
        </Card>

        {/* --- HubSpot (owner uniquement — touche un secret) ---------- */}
        {isOwner ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">HubSpot</CardTitle>
                  <CardDescription>
                    Connectez votre CRM pour enrichir les appels (contact,
                    entreprise, deal) et y pousser notes et tâches de suivi.
                  </CardDescription>
                </div>
                {hasHubspotToken ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  >
                    {hasHubspotOAuth ? "Connecté" : "Connecté (legacy)"}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  >
                    À configurer
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bandeau de retour du flux OAuth (?hubspot=...) */}
              {hubspotStatus === "connected" ? (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                  HubSpot connecté. Le tunnel a été synchronisé.
                </div>
              ) : hubspotStatus === "denied" ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  Autorisation refusée côté HubSpot. La connexion n&apos;a pas
                  été établie.
                </div>
              ) : hubspotStatus === "error" ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  La connexion HubSpot a échoué. Réessayez ; si le problème
                  persiste, contactez le support.
                </div>
              ) : null}

              <HubspotConnection connected={hasHubspotToken} canEdit={isOwner} />

              {/* Repli avancé : ancien token « Private App » collé à la main.
                  Conservé pour les portails qui ne passent pas par l'OAuth.
                  getHubspotToken privilégie toujours l'OAuth (J38). */}
              <details className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-foreground">
                  Avancé : utiliser un token Private App
                </summary>
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    À réserver aux cas où l&apos;OAuth n&apos;est pas possible. La
                    connexion en un clic ci-dessus est recommandée.
                  </p>
                  <HubspotSettingsForm
                    canEdit={isOwner}
                    hasToken={hasHubspotLegacy}
                    defaultPortalId={hubspotPortalId}
                  />
                </div>
              </details>

              {/* --- Tunnel HubSpot (J27) : carte des pipelines + phases ---- */}
              {hasHubspotToken ? (
                <div className="space-y-3 border-t border-border pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">Tunnel HubSpot</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        La carte de vos pipelines de deals, lue depuis HubSpot.
                        Elle servira à lire chaque appel selon la phase du deal.
                      </p>
                    </div>
                    <PipelineRefreshButton />
                  </div>

                  {pipelines.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Tunnel pas encore synchronisé. Cliquez sur « Rafraîchir le
                      tunnel » pour le lire depuis HubSpot.
                    </p>
                  ) : (
                    <TunnelPreview pipelines={pipelines} syncedAt={syncedAt} />
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
