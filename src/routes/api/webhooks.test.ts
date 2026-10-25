import { beforeEach, expect, it, vi } from 'vitest'
import Stripe from 'stripe'
import { encodeSignatureHeader, SIGNATURE_HEADER_NAME } from '@sanity/webhook'
import { Route as StripeRoute } from './stripe-webhook'
import { Route as SanityRoute } from './sanity-webhook'

const events = { zaplaceno: vi.fn(), vracenyPenize: vi.fn(), vyrizeno: vi.fn() }
vi.mock('#/server/order-events', () => ({ orderEventsFromEnv: () => events }))

const SECRET = 'whsec_test'
process.env.STRIPE_WEBHOOK_SECRET = SECRET
process.env.STRIPE_SECRET_KEY = 'sk_test_x'
process.env.SANITY_WEBHOOK_SECRET = SECRET
beforeEach(() => vi.clearAllMocks())

type Handler = (ctx: { request: Request }) => Promise<Response>
const post = (route: unknown, request: Request) =>
  ((route as { options: { server: { handlers: { POST: Handler } } } }).options.server.handlers.POST)({ request })

const stripeRequest = async (type: string, object: object, secret = SECRET) => {
  const payload = JSON.stringify({ id: 'evt_1', object: 'event', type, data: { object } })
  const header = await new Stripe('sk_test_x').webhooks.generateTestHeaderStringAsync({ payload, secret })
  return new Request('http://x/api/stripe-webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': header } })
}

it('stripe: paid checkout session creates the order', async () => {
  const session = { id: 'cs_1', payment_status: 'paid' }
  const res = await post(StripeRoute, await stripeRequest('checkout.session.completed', session))
  expect(res.status).toBe(200)
  expect(events.zaplaceno).toHaveBeenCalledWith(session)
})

it('stripe: unpaid (delayed) checkout session does not create the order', async () => {
  await post(StripeRoute, await stripeRequest('checkout.session.completed', { id: 'cs_1', payment_status: 'unpaid' }))
  expect(events.zaplaceno).not.toHaveBeenCalled()
})

it('stripe: delayed payment that later succeeds creates the order', async () => {
  const session = { id: 'cs_1', payment_status: 'paid' }
  await post(StripeRoute, await stripeRequest('checkout.session.async_payment_succeeded', session))
  expect(events.zaplaceno).toHaveBeenCalledWith(session)
})

it('stripe: bad signature → 400', async () => {
  const res = await post(StripeRoute, await stripeRequest('checkout.session.completed', { payment_status: 'paid' }, 'whsec_wrong'))
  expect(res.status).toBe(400)
  expect(events.zaplaceno).not.toHaveBeenCalled()
})

const sanityRequest = async (body: object, secret = SECRET) => {
  const payload = JSON.stringify(body)
  const header = await encodeSignatureHeader(payload, Date.now(), secret)
  return new Request('http://x/api/sanity-webhook', { method: 'POST', body: payload, headers: { [SIGNATURE_HEADER_NAME]: header } })
}

it('sanity: order set to vyrizena triggers vyrizeno', async () => {
  const res = await post(SanityRoute, await sanityRequest({ _id: 'o1', stav: 'vyrizena' }))
  expect(res.status).toBe(200)
  expect(events.vyrizeno).toHaveBeenCalledWith('o1')
})

it('sanity: bad signature → 401', async () => {
  const res = await post(SanityRoute, await sanityRequest({ _id: 'o1', stav: 'vyrizena' }, 'wrong'))
  expect(res.status).toBe(401)
  expect(events.vyrizeno).not.toHaveBeenCalled()
})
