import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@sanity/client'
import Stripe from 'stripe'
import { orderFromSession } from '#/server/orders'

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

        if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
          const session = event.data.object
          const { data: lineItems } = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 })
          const sanity = createClient({
            projectId: process.env.SANITY_PROJECT_ID,
            dataset: process.env.SANITY_DATASET ?? 'production',
            apiVersion: '2025-01-01',
            token: process.env.SANITY_WRITE_TOKEN,
            useCdn: false,
          })
          // Idempotent: Stripe retries deliveries, the session id is the order id.
          await sanity.createIfNotExists(orderFromSession(session, lineItems))
        }
        return new Response('ok')
      },
    },
  },
})
