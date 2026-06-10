// ============================================================================
// POST /api/stripe/change-plan — Changer de plan sans créer de doublon (J9)
// ============================================================================
// Met à jour la subscription Stripe existante avec proration_behavior auto :
// l'user est crédité du temps non consommé sur l'ancien plan, puis facturé
// au prorata du nouveau plan jusqu'à la fin de la période.
// Stripe gère la facture et le webhook subscription.updated mettra à jour la DB.
// ============================================================================

import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const ALLOWED_PRICE_IDS = new Set([
  "price_1TUOJlKEQtH8ak8XHjB05eAM", // starter
  "price_1TUOKAKEQtH8ak8X55tGmPrt", // growth
  "price_1TUOKPKEQtH8ak8XTlRJYnCg", // scale
]);

export async function POST(req: NextRequest) {
  let body: { priceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const priceId = body.priceId;
  if (!priceId || !ALLOWED_PRICE_IDS.has(priceId)) {
    return NextResponse.json({ error: "Invalid priceId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }
  // Seul l'owner peut modifier la facturation de l'org.
  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_subscription_id")
    .eq("id", profile.organization_id)
    .single();

  if (!org?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "No active subscription" },
      { status: 400 },
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  // 1. Récupérer la subscription pour avoir l'item à remplacer
  const subscription = await stripe.subscriptions.retrieve(
    org.stripe_subscription_id,
  );
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) {
    return NextResponse.json({ error: "No subscription item" }, { status: 500 });
  }

  // Si le price actuel = price demandé, rien à faire
  if (subscription.items.data[0]?.price.id === priceId) {
    return NextResponse.json({ alreadyOnPlan: true });
  }

  // 2. Update : on remplace le price, Stripe calcule la proration automatiquement
  await stripe.subscriptions.update(org.stripe_subscription_id, {
    items: [
      {
        id: itemId,
        price: priceId,
      },
    ],
    proration_behavior: "create_prorations",
  });

  // Le webhook customer.subscription.updated se chargera de mettre à jour la DB
  // (subscription_plan + subscription_status). Pas d'écriture DB ici.
  return NextResponse.json({ success: true });
}
