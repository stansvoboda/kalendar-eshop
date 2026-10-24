import { createFileRoute } from '@tanstack/react-router'
import { isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook'
import { orderEventsFromEnv } from '#/server/order-events'

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

        const events = orderEventsFromEnv()
        await events.vyrizeno(_id)
        return new Response('ok')
      },
    },
  },
})
