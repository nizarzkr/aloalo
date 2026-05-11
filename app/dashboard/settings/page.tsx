// ============================================================================
// /dashboard/settings — Paramètres du compte
// ============================================================================
// Pour l'instant : un seul bloc, la zone "danger" avec le bouton de
// suppression RGPD. La page est destinée à accueillir d'autres réglages
// (notifications, préférences langue, etc.) au fil des sprints.
// ============================================================================

import { redirect } from "next/navigation";

import { DeleteAccountDialog } from "@/components/dashboard/delete-account-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gérez votre compte et vos préférences.
      </p>

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
          </dl>
        </CardContent>
      </Card>

      {/* Zone danger — bordure rouge volontaire pour signaler l'irréversibilité */}
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
