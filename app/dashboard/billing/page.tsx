// ============================================================================
// /dashboard/billing — abonnement & plans (J9 étape 2)
// ============================================================================
// Server Component : on lit l'org du user, on dérive le plan affiché et la date
// de renouvellement depuis Stripe (si une subscription existe), puis on rend
// les 3 cards de plans + le bouton Customer Portal si actif.
// ============================================================================

import Stripe from "stripe";
import { redirect } from "next/navigation";

// Empêche tout cache server-side : on veut toujours l'état Stripe le plus récent
// (utile au retour du Customer Portal après une annulation par exemple).
export const dynamic = "force-dynamic";

import {
  PlanActionButton,
  PortalButton,
} from "@/components/dashboard/billing-actions";
import { BillingSuccessBanner } from "@/components/dashboard/billing-success-banner";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type PlanKey = "free" | "starter" | "growth" | "scale";
type DbPlan = "starter" | "growth" | "scale";
type DbStatus = "trial" | "active" | "past_due" | "canceled";

// Catalogue affiché. Les priceId sont ceux du mode test Stripe.
const PLANS: {
  key: DbPlan;
  name: string;
  price: string;
  priceId: string;
  callsLimit: string;
  features: string[];
}[] = [
  {
    key: "starter",
    name: "Starter",
    price: "49 € / mois",
    priceId: "price_1TUOJlKEQtH8ak8XHjB05eAM",
    callsLimit: "Jusqu'à 100 appels analysés / mois",
    features: [
      "Transcription + analyse IA",
      "Dashboard équipe",
      "Support email",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    price: "99 € / mois",
    priceId: "price_1TUOKAKEQtH8ak8X55tGmPrt",
    callsLimit: "Jusqu'à 500 appels analysés / mois",
    features: [
      "Tout Starter",
      "Coaching automatique avancé",
      "Export CSV des analyses",
    ],
  },
  {
    key: "scale",
    name: "Scale",
    price: "199 € / mois",
    priceId: "price_1TUOKPKEQtH8ak8XTlRJYnCg",
    callsLimit: "Jusqu'à 2 000 appels analysés / mois",
    features: [
      "Tout Growth",
      "Webhooks personnalisés",
      "Support prioritaire",
    ],
  },
];

// Couleurs des badges plan — overrides volontaires sur la variant Badge.
const PLAN_BADGE_CLASS: Record<PlanKey, string> = {
  free: "bg-muted text-muted-foreground",
  starter: "bg-blue-100 text-blue-700",
  growth: "bg-violet-100 text-violet-700",
  scale: "bg-amber-100 text-amber-800",
};

const PLAN_LABEL: Record<PlanKey, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
};

const STATUS_LABEL: Record<DbStatus, string> = {
  trial: "Essai gratuit",
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Annulé",
};

const STATUS_BADGE_CLASS: Record<DbStatus, string> = {
  trial: "bg-blue-100 text-blue-700",
  active: "bg-emerald-100 text-emerald-700",
  past_due: "bg-amber-100 text-amber-800",
  canceled: "bg-muted text-muted-foreground",
};

// Infos d'abo récupérées depuis Stripe.
// - periodEnd : fin de la période courante (date de renouvellement OU date
//   d'annulation effective si cancel_at_period_end).
// - cancelAtPeriodEnd : flag "annulation programmée".
// - cancelAt : date exacte d'annulation, fournie par Stripe quand on programme.
async function fetchSubscriptionInfo(stripeSubscriptionId: string | null) {
  if (!stripeSubscriptionId) return null;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

    // current_period_end vit sur l'item depuis l'API Stripe 2024-04+.
    const periodEndUnix = sub.items.data[0]?.current_period_end ?? null;
    const cancelAtUnix = sub.cancel_at ?? null;

    // Log d'observabilité — utile pour diagnostiquer en cas d'incohérence.
    console.log("[billing] sub state", {
      id: sub.id,
      status: sub.status,
      cancel_at_period_end: sub.cancel_at_period_end,
      cancel_at: sub.cancel_at,
      period_end: periodEndUnix,
    });

    return {
      periodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      cancelAt: cancelAtUnix ? new Date(cancelAtUnix * 1000) : null,
    };
  } catch (err) {
    console.error("[billing] fetchSubscriptionInfo:", err);
    return null;
  }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const { success } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        <p className="text-muted-foreground">
          Aucune organisation associée à ce compte.
        </p>
      </div>
    );
  }

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "subscription_plan, subscription_status, stripe_subscription_id, trial_ends_at",
    )
    .eq("id", profile.organization_id)
    .single();

  const dbPlan = (org?.subscription_plan ?? "starter") as DbPlan;
  const dbStatus = (org?.subscription_status ?? "trial") as DbStatus;

  // Plan affiché : "Free" quand l'abo est annulé, sinon le plan en DB.
  const displayedPlan: PlanKey = dbStatus === "canceled" ? "free" : dbPlan;

  // Comparaison "is current plan" pour désactiver le bouton :
  //   - canceled : aucun plan n'est "actuel"
  //   - sinon : on compare au subscription_plan
  const currentPlanForButton: DbPlan | null =
    dbStatus === "canceled" ? null : dbPlan;

  const subInfo =
    dbStatus === "active" || dbStatus === "trial" || dbStatus === "past_due"
      ? await fetchSubscriptionInfo(org?.stripe_subscription_id ?? null)
      : null;

  const cancelScheduled = subInfo?.cancelAtPeriodEnd ?? false;
  // Date à afficher : si annulation programmée → cancel_at (fallback periodEnd).
  // Sinon → periodEnd (= prochaine date de renouvellement).
  const renewalDate = subInfo?.periodEnd ?? null;
  const endDate = subInfo?.cancelAt ?? subInfo?.periodEnd ?? null;

  const showPortal =
    !!org?.stripe_subscription_id &&
    (dbStatus === "active" || dbStatus === "past_due" || dbStatus === "trial");

  // "Active subscription" = il existe un subscription Stripe utilisable pour
  // un changement de plan (proration). Si annulé, c'est mort, on retombe sur
  // un nouveau Checkout.
  const hasActiveSubscription =
    !!org?.stripe_subscription_id && dbStatus !== "canceled";

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facturation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez votre abonnement et changez de plan à tout moment.
          </p>
        </div>
        {showPortal ? <PortalButton /> : null}
      </div>

      {success === "true" ? <BillingSuccessBanner /> : null}

      <Card className="mb-10">
        <CardHeader>
          <CardTitle>Votre abonnement</CardTitle>
          <CardDescription>État courant de votre compte.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Plan :</span>
            <Badge className={PLAN_BADGE_CLASS[displayedPlan]}>
              {PLAN_LABEL[displayedPlan]}
            </Badge>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">Statut :</span>
            <Badge className={STATUS_BADGE_CLASS[dbStatus]}>
              {STATUS_LABEL[dbStatus]}
            </Badge>
          </div>
          {renewalDate && !cancelScheduled ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Prochain renouvellement le{" "}
              <span className="font-medium text-foreground">
                {renewalDate.toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              .
            </p>
          ) : null}
          {cancelScheduled ? (
            <p className="mt-3 text-sm text-amber-700">
              Annulation programmée
              {endDate ? (
                <>
                  {" "}— votre abonnement reste actif jusqu'au{" "}
                  <span className="font-medium">
                    {endDate.toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  , puis passera en Free
                </>
              ) : null}
              . Vous pouvez réactiver depuis « Gérer mon abonnement ».
            </p>
          ) : null}
          {dbStatus === "trial" && org?.trial_ends_at ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Période d'essai jusqu'au{" "}
              <span className="font-medium text-foreground">
                {new Date(org.trial_ends_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              .
            </p>
          ) : null}
          {dbStatus === "past_due" ? (
            <p className="mt-3 text-sm text-amber-700">
              Votre dernier paiement a échoué. Mettez à jour votre moyen de
              paiement pour réactiver l'accès.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <h2 className="mb-4 text-lg font-semibold tracking-tight">
        Choisir un plan
      </h2>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentPlanForButton === plan.key;
          return (
            <Card
              key={plan.key}
              className={cn(
                "flex flex-col",
                isCurrent && "border-2 border-primary",
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent ? (
                    <Badge className={PLAN_BADGE_CLASS[plan.key]}>
                      Plan actuel
                    </Badge>
                  ) : null}
                </div>
                <CardDescription className="text-base font-semibold text-foreground">
                  {plan.price}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {plan.callsLimit}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-foreground"
                      >
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <PlanActionButton
                  priceId={plan.priceId}
                  planName={plan.name}
                  isCurrent={isCurrent}
                  hasActiveSubscription={hasActiveSubscription}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
