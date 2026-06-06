// ============================================================================
// /dashboard/settings/advanced — Avancé (zone danger : suppression de compte)
// ============================================================================

import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { DeleteAccountDialog } from "@/components/dashboard/delete-account-dialog";
import { SectionHeading } from "@/components/dashboard/section-heading";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdvancedSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div>
      <SectionHeading
        icon={ShieldAlert}
        title="Avancé"
        description="Actions sensibles et irréversibles."
      />
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Supprimer mon compte
          </CardTitle>
          <CardDescription>
            La suppression est définitive. Toutes vos données (appels,
            transcriptions, analyses, abonnement et organisation) seront
            effacées immédiatement, conformément au droit à l&apos;effacement
            (RGPD art. 17).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </div>
  );
}
