import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@sanity/client'
import Stripe from 'stripe'
import { createOrderEvents, sanityOrderStore, stripePayments } from '#/server/order-events'

export const Route = createFileRoute('/api/stripe-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get('stripe-signature')
        const secret = process.env.STRIPE_WEBHOOK_SECRET
        if (!signature || !secret) return new Response('Missing signature', { status: 400 })

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
        let event: Stripe.Event
        try {
          event = await stripe.webhooks.constructEventAsync(await request.text(), signature, secret)
        } catch {
          return new Response('Invalid signature', { status: 400 })
        }

        const sanity = createClient({
          projectId: process.env.SANITY_PROJECT_ID,
          dataset: process.env.SANITY_DATASET ?? 'production',
          apiVersion: '2025-01-01',
          token: process.env.SANITY_WRITE_TOKEN,
          useCdn: false,
        })
        const events = createOrderEvents({ store: sanityOrderStore(sanity), payments: stripePayments(stripe) })

        if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
          await events.zaplaceno(event.data.object)
        }
        return new Response('ok')
      },
    },
  },
})
