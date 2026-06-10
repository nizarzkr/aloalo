// ============================================================================
// POST /api/stripe/checkout — Crée une Checkout Session Stripe (J9 étape 2)
// ============================================================================
// Reçoit { priceId }, identifie l'org du user connecté, réutilise ou crée le
// customer Stripe, ouvre une session Checkout en mode subscription.
// ============================================================================

import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  apiLimiter,
  checkRateLimit,
  getClientKey,
  rateLimitedResponse,
} from "@/lib/rate-limit";

const PRICE_TO_PLAN: Record<string, "starter" | "growth" | "scale"> = {
  price_1TUOJlKEQtH8ak8XHjB05eAM: "starter",
  price_1TUOKAKEQtH8ak8X55tGmPrt: "growth",
  price_1TUOKPKEQtH8ak8XTlRJYnCg: "scale",
};

export async function POST(req: NextRequest) {
  // Rate limit — clé par IP (avant auth pour fail-fast sur flood).
  const rl = await checkRateLimit(apiLimiter, getClientKey(req));
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterSeconds);
  }

  // 1. Body
  let body: { priceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const priceId = body.priceId;
  if (!priceId || !PRICE_TO_PLAN[priceId]) {
    return NextResponse.json({ error: "Invalid priceId" }, { status: 400 });
  }

  // 2. User connecté + org
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, email, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }
  // Seul l'owner peut souscrire un abonnement payant pour l'org.
  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, stripe_customer_id")
    .eq("id", profile.organization_id)
    .single();

  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  // 3. Customer Stripe : on réutilise s'il existe, sinon on en crée un nouveau.
  //    Le stripe_customer_id final sera persisté en DB par le webhook
  //    (event checkout.session.completed) — pas besoin d'écrire ici.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  let customerId = org.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email ?? user.email ?? undefined,
      metadata: {
        organization_id: org.id,
        organization_name: org.name,
      },
    });
    customerId = customer.id;
  }

  // 4. Checkout Session
  // On utilise l'origine de la requête plutôt que NEXT_PUBLIC_APP_URL :
  // ça marche en dev (localhost) ET en prod (Vercel) sans config par env.
  const appUrl = req.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/settings/billing?success=true`,
    cancel_url: `${appUrl}/dashboard/settings/billing`,
    // client_reference_id permet au webhook de retrouver l'org au tout premier
    // checkout (avant que stripe_customer_id ne soit persisté en DB).
    client_reference_id: org.id,
    metadata: {
      organization_id: org.id,
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "No session url" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
