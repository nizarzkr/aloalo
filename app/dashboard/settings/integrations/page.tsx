// ============================================================================
// /dashboard/settings/integrations — Ringover + HubSpot
// ============================================================================

import { redirect } from "next/navigation";
import { Cable } from "lucide-react";

import { CopyButton } from "@/components/dashboard/copy-button";
import { HubspotSettingsForm } from "@/components/dashboard/hubspot-settings-form";
import { RingoverKeyForm } from "@/components/dashboard/ringover-key-form";
import { SectionHeading } from "@/components/dashboard/section-heading";
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

export default async function IntegrationsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("organizations")
      .select("ringover_api_key, hubspot_token, hubspot_portal_id")
      .maybeSingle(),
  ]);

  const isOwner = profile?.role === "owner";
  // On ne lit que la PRÉSENCE des secrets, jamais leur valeur (cf. RLS / serveur).
  const hasRingoverKey = Boolean(
    org?.ringover_api_key && org.ringover_api_key.length > 0,
  );
  const hasHubspotToken = Boolean(
    org?.hubspot_token && org.hubspot_token.length > 0,
  );
  const hubspotPortalId = org?.hubspot_portal_id ?? "";

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
                    Configuré
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
            <CardContent>
              <HubspotSettingsForm
                canEdit={isOwner}
                hasToken={hasHubspotToken}
                defaultPortalId={hubspotPortalId}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
