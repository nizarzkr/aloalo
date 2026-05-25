// ============================================================================
// /dashboard/settings — Paramètres du compte et de l'organisation
// ============================================================================
// Sections :
//   1. Compte (lecture seule — informations du user courant)
//   2. Mon organisation (édition du nom + URL logo, owner uniquement)
//   3. Intégration Ringover (URL de webhook à communiquer au support)
//   4. Profil IA (contexte commercial injecté dans le prompt Claude — J14)
//   5. Zone danger (suppression de compte RGPD — J10)
//
// Server Component pour le chargement des données. Le formulaire org passe
// par un wrapper client minimal (`OrgSettingsForm`) afin d'utiliser
// useActionState et afficher inline le résultat du Server Action.
// ============================================================================

import { redirect } from "next/navigation";

import { AiProfileForm } from "@/components/dashboard/ai-profile-form";
import { CopyButton } from "@/components/dashboard/copy-button";
import { DeleteAccountDialog } from "@/components/dashboard/delete-account-dialog";
import { OrgSettingsForm } from "@/components/dashboard/org-settings-form";
import { RingoverKeyForm } from "@/components/dashboard/ringover-key-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { AiProfileData } from "@/lib/validations";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Lectures en parallèle : la RLS sur `organizations` filtre déjà au seul
  // enregistrement du user courant (cf. policy "Users can view their own
  // organization"), donc pas besoin de .eq() pour cibler l'org.
  //
  // Note : on lit ici la présence (booléenne) d'une clé Ringover, JAMAIS sa
  // valeur. La clé reste cantonnée aux Server Actions et au webhook.
  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", user.id)
      .single(),
    supabase
      .from("organizations")
      .select("id, name, logo_url, ringover_api_key, ai_profile")
      .maybeSingle(),
  ]);

  const isOwner = profile?.role === "owner";
  const hasRingoverKey = Boolean(
    org?.ringover_api_key && org.ringover_api_key.length > 0,
  );
  // ai_profile est un jsonb en DB → `unknown` côté TS. On le caste prudemment
  // en Partial<AiProfileData> ; le composant supporte les clés manquantes.
  const aiProfile =
    (org?.ai_profile as Partial<AiProfileData> | null | undefined) ?? null;

  // URL du webhook Ringover — construite à partir de NEXT_PUBLIC_APP_URL pour
  // pointer vers la prod (ou la preview Vercel), pas vers localhost.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  const webhookUrl = `${appUrl}/api/webhooks/ringover`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gérez votre compte, votre organisation et vos intégrations.
      </p>

      {/* ---------------------------------------------------------------- */}
      {/* 1. Compte                                                         */}
      {/* ---------------------------------------------------------------- */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Compte</CardTitle>
          <CardDescription>Informations de votre compte.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-[120px_1fr]">
            <dt className="text-muted-foreground">Nom</dt>
            <dd className="font-medium text-foreground">
              {profile?.full_name ?? "—"}
            </dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium text-foreground">
              {profile?.email ?? user.email}
            </dd>
            <dt className="text-muted-foreground">Rôle</dt>
            <dd className="font-medium text-foreground capitalize">
              {profile?.role ?? "—"}
            </dd>
          </dl>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Mon organisation                                               */}
      {/* ---------------------------------------------------------------- */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Mon organisation</CardTitle>
          <CardDescription>
            Nom affiché dans la sidebar et URL du logo de votre entreprise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {org ? (
            <OrgSettingsForm
              defaultName={org.name ?? ""}
              defaultLogoUrl={org.logo_url ?? ""}
              canEdit={isOwner}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Impossible de charger votre organisation.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* 3. Intégration Ringover                                           */}
      {/* ---------------------------------------------------------------- */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Intégration Ringover</CardTitle>
              <CardDescription>
                Synchronisez automatiquement vos appels Ringover avec Aloalo.
              </CardDescription>
            </div>
            {/* Badge dynamique : vert dès qu'une clé API est enregistrée.
                Reste « en attente » tant qu'aucune clé n'a été collée. */}
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
                En attente de configuration
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* --- 3a. Clé API Ringover ----------------------------------- */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Clé API Ringover</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Permet à Aloalo de récupérer l&apos;enregistrement audio de
                chaque appel reçu via le webhook. La clé est stockée chiffrée
                côté serveur et n&apos;est jamais affichée en clair.
              </p>
            </div>
            <RingoverKeyForm canEdit={isOwner} hasKey={hasRingoverKey} />
          </section>

          {/* --- 3b. URL du webhook ------------------------------------- */}
          <section className="space-y-2 border-t border-border pt-6">
            <h3 className="text-sm font-medium">URL du webhook</h3>
            <p className="text-xs text-muted-foreground">
              Collez cette URL dans Ringover &rsaquo; Paramètres &rsaquo;
              Webhooks pour déclencher la synchronisation à chaque appel
              terminé.
            </p>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground">
                {webhookUrl || "URL non configurée (NEXT_PUBLIC_APP_URL manquant)"}
              </code>
              {webhookUrl ? (
                <CopyButton value={webhookUrl} label="Copier l'URL" />
              ) : null}
            </div>
          </section>

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

      {/* ---------------------------------------------------------------- */}
      {/* 4. Profil IA                                                      */}
      {/* ---------------------------------------------------------------- */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Profil IA</CardTitle>
          <CardDescription>
            Ce contexte est injecté dans l&apos;analyse IA de chaque appel.
            Plus il est précis, plus le coaching généré sera pertinent pour
            votre équipe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AiProfileForm defaultValues={aiProfile} canEdit={isOwner} />
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* 5. Zone danger                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Card className="mt-8 border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Zone danger</CardTitle>
          <CardDescription>
            La suppression de votre compte est définitive. Toutes vos données
            (appels, transcriptions, analyses, abonnement et organisation)
            seront effacées immédiatement, conformément au droit à
            l&apos;effacement (RGPD art. 17).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </div>
  );
}
