import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@sanity/client'
import { isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook'
import Stripe from 'stripe'
import { createOrderEvents, sanityOrderStore, sanityStock, stripePayments } from '#/server/order-events'
import { resendMailer } from '#/server/mailer'
import { deliveryConfig } from '#/server/shop'

// GROQ-powered Sanity webhook on order stav change; projection `{_id, stav}` (see README).
export const Route = createFileRoute('/api/sanity-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get(SIGNATURE_HEADER_NAME)
        const secret = process.env.SANITY_WEBHOOK_SECRET
        if (!signature || !secret) return new Response('Missing signature', { status: 401 })
        const body = await request.text()
        if (!(await isValidSignature(body, signature, secret))) return new Response('Invalid signature', { status: 401 })

        const { _id, stav } = JSON.parse(body) as { _id?: string; stav?: string }
        if (stav !== 'vyrizena' || !_id) return new Response('ignored')

        const sanity = createClient({
          projectId: process.env.SANITY_PROJECT_ID,
          dataset: process.env.SANITY_DATASET ?? 'production',
          apiVersion: '2025-01-01',
          token: process.env.SANITY_WRITE_TOKEN,
          useCdn: false,
        })
        const events = createOrderEvents({
          store: sanityOrderStore(sanity),
          stock: sanityStock(sanity),
          payments: stripePayments(new Stripe(process.env.STRIPE_SECRET_KEY!)),
          mailer: resendMailer(process.env.RESEND_API_KEY!, process.env.EMAIL_FROM || 'Kalendáře <onboarding@resend.dev>'),
          shop: { merchantEmail: process.env.MERCHANT_EMAIL!, pickupPlace: deliveryConfig().pickupPlace },
        })
        await events.vyrizeno(_id)
        return new Response('ok')
      },
    },
  },
})
