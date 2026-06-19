// ============================================================================
// /onboarding — Assistant de configuration assisté IA (J29)
// ============================================================================
// Page serveur qui orchestre les 3 étapes (téléphonie → HubSpot → critères). La
// PROGRESSION est calculée depuis les signaux réels (lib/onboarding) ; l'étape
// active vient du ?step= (validé), à défaut la 1re étape incomplète. Le layout
// (app/onboarding/layout.tsx) a déjà garanti : auth + owner + non terminé.
//
// Réutilisation maximale : aucun formulaire neuf. Les étapes encapsulent
// RingoverKeyForm / HubspotSettingsForm / ExitCriteriaEditor existants.
// ============================================================================

import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { OnboardingStepper } from "@/components/onboarding/onboarding-stepper";
import { StepCriteria } from "@/components/onboarding/step-criteria";
import { StepHubspot } from "@/components/onboarding/step-hubspot";
import { StepTelephony } from "@/components/onboarding/step-telephony";
import { type EditorPipeline } from "@/components/dashboard/exit-criteria-editor";
import { hasSecret } from "@/lib/crypto/org-secrets";
import { getOrgExitCriteria } from "@/lib/exit-criteria";
import { getCrmAdapter } from "@/lib/crm";
import {
  getOnboardingState,
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isStepId(v: string | undefined): v is OnboardingStepId {
  return v != null && (ONBOARDING_STEPS as readonly string[]).includes(v);
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;

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

  // Garde déjà assurée par le layout ; ceinture-bretelles si accès direct.
  if (profile?.role !== "owner" || !profile.organization_id) {
    redirect("/dashboard");
  }
  const orgId = profile.organization_id;

  // Données nécessaires aux étapes (lues en parallèle).
  const crm = await getCrmAdapter(orgId);
  const [state, org, { pipelines, syncedAt }, criteriaMap] = await Promise.all([
    getOnboardingState(orgId),
    admin
      .from("organizations")
      .select("hubspot_portal_id, ringover_api_key, hubspot_token, hubspot_refresh_token")
      .eq("id", orgId)
      .maybeSingle()
      .then((r) => r.data),
    crm.getStoredPipelines(),
    getOrgExitCriteria(orgId),
  ]);

  // Étape active : ?step= s'il est valide, sinon la 1re incomplète, sinon la
  // dernière (toutes faites mais assistant non « terminé »).
  const activeStep: OnboardingStepId = isStepId(step)
    ? step
    : (state.firstIncompleteStep ?? ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]);

  // URL du webhook Ringover (basée sur NEXT_PUBLIC_APP_URL, comme la page Intégrations).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
  const webhookUrl = appUrl ? `${appUrl}/api/webhooks/ringover` : "";

  // Mapping pipelines → éditeur (phases ouvertes uniquement), repris de
  // app/dashboard/settings/exit-criteria/page.tsx. Les critères orphelins (phase
  // supprimée côté HubSpot) sont filtrés par cette jointure.
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
      <OnboardingStepper steps={state.steps} activeStep={activeStep} />

      {activeStep === "telephony" ? (
        <StepTelephony
          hasRingoverKey={hasSecret(org?.ringover_api_key)}
          webhookUrl={webhookUrl}
        />
      ) : null}

      {activeStep === "hubspot" ? (
        <StepHubspot
          hasHubspotToken={
            hasSecret(org?.hubspot_token) ||
            hasSecret(org?.hubspot_refresh_token)
          }
          pipelines={pipelines}
          syncedAt={syncedAt}
          done={state.steps.hubspot}
        />
      ) : null}

      {activeStep === "criteria" ? (
        <StepCriteria
          editorPipelines={editorPipelines}
          hasAnyCriteria={hasAnyCriteria}
          done={state.steps.criteria}
        />
      ) : null}
    </div>
  );
}
