// ============================================================================
// POST /api/stripe/portal — Customer Portal Stripe (J9 étape 2)
// ============================================================================
// Crée une session vers le Portal Stripe pour gérer/annuler l'abonnement.
// L'org doit déjà avoir un stripe_customer_id (sinon il n'y a rien à gérer).
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
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
  // Seul l'owner peut gérer/annuler l'abonnement via le Customer Portal.
  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", profile.organization_id)
    .single();

  if (!org?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No active subscription" },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  // Origine de la requête : marche en dev (localhost) et en prod (Vercel).
  const appUrl = req.nextUrl.origin;

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${appUrl}/dashboard/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
