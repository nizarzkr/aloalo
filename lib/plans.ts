// ============================================================================
// Paywall — limites par plan et vérification de la consommation par période.
// ============================================================================
// Conventions retenues côté produit :
//  - Plan "free" : org en subscription_status = 'canceled' OU 'past_due'.
//  - Plans "starter/growth/scale" : lecture directe du subscription_plan en DB
//    (uniquement valide quand subscription_status ∈ {trial, active}).
//  - Période : current_period_start de la subscription Stripe (anniversaire de
//    souscription). Fallback sur le 1er du mois calendaire en UTC si pas de
//    sub Stripe disponible (org en trial non payé, ou erreur API).
// ============================================================================

import { createClient } from "@supabase/supabase-js";

import { getStripe } from "@/lib/stripe";

export type EffectivePlan = "free" | "starter" | "growth" | "scale";

export const PLAN_LIMITS: Record<EffectivePlan, number> = {
  free: 3,
  starter: 100,
  growth: 500,
  scale: 2000,
};

// Libellés et prix d'affichage. Centralisés ici pour que tout consommateur UI
// (banner d'upgrade, futures emails de quota, etc.) parte de la même source.
// Le catalogue détaillé (priceId Stripe, features) reste sur la page billing.
export const PLAN_NAMES: Record<EffectivePlan, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
};

export const PLAN_PRICES: Record<EffectivePlan, string> = {
  free: "0 € / mois",
  starter: "49 € / mois",
  growth: "99 € / mois",
  scale: "199 € / mois",
};

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

// Détermine le plan effectif à partir des deux colonnes DB.
// Une org canceled/past_due perd ses droits payants peu importe le plan stocké.
export function resolveEffectivePlan(
  subscriptionStatus: string | null,
  subscriptionPlan: string | null,
): EffectivePlan {
  if (subscriptionStatus === "canceled" || subscriptionStatus === "past_due") {
    return "free";
  }
  if (
    subscriptionPlan === "starter" ||
    subscriptionPlan === "growth" ||
    subscriptionPlan === "scale"
  ) {
    return subscriptionPlan;
  }
  // Plan inattendu en DB → on bride par sécurité.
  return "free";
}

// Renvoie l'ancrage de la période de facturation courante.
// current_period_start vit sur l'item depuis l'API Stripe 2024-04+.
async function getPeriodStart(
  stripeSubscriptionId: string | null,
): Promise<Date> {
  const firstOfMonth = new Date();
  firstOfMonth.setUTCDate(1);
  firstOfMonth.setUTCHours(0, 0, 0, 0);

  if (!stripeSubscriptionId) return firstOfMonth;

  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const periodStartUnix = sub.items.data[0]?.current_period_start;
    if (!periodStartUnix) return firstOfMonth;
    return new Date(periodStartUnix * 1000);
  } catch (err) {
    console.error("[plans] getPeriodStart fallback calendrier:", err);
    return firstOfMonth;
  }
}

// Compte les analyses 'analyzed' depuis le début de la période et compare au
// quota du plan. Renvoie used/limit aussi pour l'affichage UX (402 + UI).
export async function checkUsageLimit(
  orgId: string,
  plan: EffectivePlan,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = PLAN_LIMITS[plan];
  const supabase = adminClient();

  // On va chercher l'ancrage de période depuis Stripe (via stripe_subscription_id).
  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_subscription_id")
    .eq("id", orgId)
    .single();

  const periodStart = await getPeriodStart(
    org?.stripe_subscription_id ?? null,
  );

  // head: true + count: 'exact' → ne ramène pas les lignes, juste le compteur.
  const { count, error } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "analyzed")
    .gte("created_at", periodStart.toISOString());

  if (error) {
    // Erreur transient DB : on laisse passer pour ne pas bloquer l'utilisateur
    // sur un coup de chaud Supabase. Coût max : 1 analyse "offerte".
    console.error("[plans] checkUsageLimit count error:", error);
    return { allowed: true, used: 0, limit };
  }

  const used = count ?? 0;
  return { allowed: used < limit, used, limit };
}
