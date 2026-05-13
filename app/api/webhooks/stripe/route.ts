import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'

// Mapping Price ID Stripe (mode test) → plan en DB.
// Les Product IDs (prod_…) ne sont pas utilisables ici : Stripe envoie le Price ID
// dans subscription.items.data[].price.id.
const PRICE_TO_PLAN: Record<string, 'starter' | 'growth' | 'scale'> = {
  price_1TUOJlKEQtH8ak8XHjB05eAM: 'starter',
  price_1TUOKAKEQtH8ak8X55tGmPrt: 'growth',
  price_1TUOKPKEQtH8ak8XTlRJYnCg: 'scale',
}

// Stripe utilise 'trialing', notre check constraint utilise 'trial'.
// Les autres status Stripe (incomplete, incomplete_expired, unpaid, paused) sont
// ignorés volontairement pour le MVP — ils ne correspondent à rien de stable.
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
): 'trial' | 'active' | 'past_due' | 'canceled' | null {
  switch (stripeStatus) {
    case 'trialing':
      return 'trial'
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    default:
      return null
  }
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
}

export async function POST(req: NextRequest) {
  // 1. Lire le body brut — obligatoire pour vérifier la signature Stripe.
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  // 2. Vérifier la signature. Si invalide → 400.
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error('[webhook/stripe] Signature invalide:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = adminClient()

  // 3. Dispatch des 4 events. On enveloppe dans try/catch pour répondre 200
  //    même en cas d'erreur applicative (sinon Stripe re-tente le webhook).
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        const customerId =
          typeof session.customer === 'string' ? session.customer : null
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : null

        if (!customerId || !subscriptionId) {
          console.warn(
            '[webhook/stripe] checkout.session.completed sans customer/subscription — ignoré',
            { sessionId: session.id, mode: session.mode },
          )
          break
        }

        // Récupère la subscription pour obtenir le Price ID → plan.
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id
        const plan = priceId ? PRICE_TO_PLAN[priceId] : null

        if (priceId && !plan) {
          console.warn(
            '[webhook/stripe] Price ID inconnu, plan non mis à jour:',
            priceId,
          )
        }

        // Identification de l'org :
        //   - Premier checkout : client_reference_id (set à la création du checkout en J9 étape 2)
        //   - Sinon : on retrouve l'org via stripe_customer_id déjà enregistré.
        const orgIdFromSession = session.client_reference_id

        const updatePayload: Record<string, string> = {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: 'active',
        }
        if (plan) updatePayload.subscription_plan = plan

        if (orgIdFromSession) {
          const { error } = await supabase
            .from('organizations')
            .update(updatePayload)
            .eq('id', orgIdFromSession)
          if (error)
            console.error('[webhook/stripe] update org (par id):', error)
        } else {
          const { error } = await supabase
            .from('organizations')
            .update(updatePayload)
            .eq('stripe_customer_id', customerId)
          if (error)
            console.error('[webhook/stripe] update org (par customer):', error)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : null
        if (!customerId) break

        const mapped = mapStripeStatus(sub.status)
        if (!mapped) {
          console.log(
            '[webhook/stripe] subscription.updated status ignoré:',
            sub.status,
          )
          break
        }

        // Cet event est aussi déclenché par notre route /api/stripe/change-plan
        // (Stripe émet subscription.updated sur tout subscriptions.update).
        // On met donc à jour le plan en plus du status, basé sur le price_id.
        const priceId = sub.items.data[0]?.price.id
        const plan = priceId ? PRICE_TO_PLAN[priceId] : null

        const updatePayload: Record<string, string> = {
          subscription_status: mapped,
        }
        if (plan) updatePayload.subscription_plan = plan

        const { error } = await supabase
          .from('organizations')
          .update(updatePayload)
          .eq('stripe_customer_id', customerId)
        if (error) console.error('[webhook/stripe] update status:', error)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : null
        if (!customerId) break

        // Volontairement, on ne touche pas à subscription_plan : la check constraint
        // n'autorise pas 'free'. Le paywall se base sur subscription_status.
        const { error } = await supabase
          .from('organizations')
          .update({ subscription_status: 'canceled' })
          .eq('stripe_customer_id', customerId)
        if (error) console.error('[webhook/stripe] cancel:', error)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : null
        if (!customerId) break

        const { error } = await supabase
          .from('organizations')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', customerId)
        if (error) console.error('[webhook/stripe] past_due:', error)
        break
      }

      default:
        // Tous les autres events sont ignorés.
        break
    }
  } catch (err) {
    console.error(
      '[webhook/stripe] Erreur traitement event',
      event.type,
      err,
    )
    Sentry.captureException(err, {
      tags: { route: '/api/webhooks/stripe', eventType: event.type },
      extra: { eventId: event.id },
    })
    // On répond quand même 200 — éviter une boucle de retries Stripe sur un bug.
  }

  // Invalide le cache de la page billing pour que la prochaine visite voie
  // l'état frais (utile après annulation / changement de plan / paiement).
  revalidatePath('/dashboard/billing')

  return NextResponse.json({ received: true })
}
