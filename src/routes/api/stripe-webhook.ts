import { createFileRoute } from '@tanstack/react-router'
import Stripe from 'stripe'
import { orderEventsFromEnv } from '#/server/order-events'

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

        const events = orderEventsFromEnv(stripe)

        if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
          await events.zaplaceno(event.data.object)
        }
        if (event.type === 'charge.refunded') {
          // Re-fetched: webhook charges don't include their refunds.
          await events.vracenyPenize(await stripe.charges.retrieve(event.data.object.id, { expand: ['refunds'] }))
        }
        return new Response('ok')
      },
    },
  },
})
