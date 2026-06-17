// ============================================================================
// /dashboard/settings/exit-criteria — Critères de sortie de phase (J28)
// ============================================================================
// Pour chaque PHASE OUVERTE du tunnel HubSpot (capté en J27), l'IA propose des
// critères de sortie que l'owner valide/ajuste. Owner-only (config org + dépense
// IA). Réutilisé plus tard par l'onboarding (J29).

import Link from "next/link";
import { redirect } from "next/navigation";
import { ListChecks } from "lucide-react";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import {
  ExitCriteriaEditor,
  type EditorPipeline,
} from "@/components/dashboard/exit-criteria-editor";
import { SectionHeading } from "@/components/dashboard/section-heading";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { getOrgExitCriteria } from "@/lib/exit-criteria";
import { getOrgPipelines } from "@/lib/hubspot-pipelines";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ExitCriteriaSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  const isOwner = profile?.role === "owner";

  const heading = (
    <SectionHeading
      icon={ListChecks}
      title="Critères de sortie"
      description="Définissez, pour chaque phase de votre tunnel, ce qui doit être vrai pour qu'un deal avance. L'IA propose, vous ajustez."
    />
  );

  if (!isOwner) {
    return (
      <div>
        {heading}
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Seul le propriétaire du compte peut gérer les critères de sortie.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Carte du tunnel (J27) + critères persistés (J28).
  const { pipelines } = profile?.organization_id
    ? await getOrgPipelines(profile.organization_id)
    : { pipelines: [] };
  const criteriaMap = profile?.organization_id
    ? await getOrgExitCriteria(profile.organization_id)
    : {};

  // Aucun tunnel synchronisé → on renvoie vers les Intégrations (pré-requis J27).
  if (pipelines.length === 0) {
    return (
      <div>
        {heading}
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun tunnel HubSpot synchronisé pour le moment.
            </p>
            <p className="text-sm text-muted-foreground">
              Connectez HubSpot et synchronisez votre tunnel d&apos;abord, puis
              revenez ici proposer vos critères.
            </p>
            <Link
              href="/dashboard/settings/integrations"
              className="inline-block text-sm font-medium text-foreground underline underline-offset-4"
            >
              Aller aux Intégrations
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // On ne garde QUE les phases ouvertes (≠ gagné/perdu) ; les critères orphelins
  // (phase supprimée côté HubSpot) sont naturellement filtrés par cette jointure.
  const editorPipelines: EditorPipeline[] = pipelines
    .map((p) => ({
      id: p.id,
      label: p.label,
      stages: p.stages
        .filter((s) => !s.isClosed)
        .map((s) => {
          const entry = criteriaMap[s.id];
          return {
            stageId: s.id,
            stageLabel: s.label,
            criteria: (entry?.criteria ?? []).map((c) => c.label),
            aiGeneratedAt: entry?.ai_generated_at ?? null,
            editedAt: entry?.edited_at ?? null,
          };
        }),
    }))
    .filter((p) => p.stages.length > 0);

  const hasAnyCriteria = editorPipelines.some((p) =>
    p.stages.some((s) => s.criteria.length > 0),
  );

  return (
    <div>
      {heading}
      <ExitCriteriaEditor
        pipelines={editorPipelines}
        hasAnyCriteria={hasAnyCriteria}
      />
    </div>
  );
}
