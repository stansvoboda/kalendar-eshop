import { expect, it } from 'vitest'
import Stripe from 'stripe'
import { paidOrderSummary } from './thank-you'

const lineItem = { id: 'li_1', description: 'Kalendář A', quantity: 2, amount_total: 78_000 }

function fakeStripe(session: Stripe.Checkout.Session | Error) {
  return {
    checkout: {
      sessions: {
        retrieve: async () => {
          if (session instanceof Error) throw session
          return session
        },
        listLineItems: async () => ({ data: [lineItem] }),
      },
    },
  } as unknown as Stripe
}

const paid = {
  id: 'cs_test_1',
  created: 1_700_000_000,
  status: 'complete',
  payment_status: 'paid',
  metadata: { name: 'Jan', delivery: 'adresa' },
  customer_details: { email: 'jan@example.cz' },
  amount_total: 87_900,
  shipping_cost: { amount_total: 9_900 },
} as unknown as Stripe.Checkout.Session

it('returns the summary of a paid Checkout Session without personal data', async () => {
  expect(await paidOrderSummary(fakeStripe(paid), 'cs_test_1')).toEqual({
    items: [{ _key: 'li_1', name: 'Kalendář A', qty: 2, subtotal: 780 }],
    delivery: 'adresa',
    deliveryPrice: 99,
    total: 879,
    paid: true,
  })
})

it('a completed session with a delayed payment returns the summary marked not yet paid', async () => {
  const pending = { ...paid, status: 'complete', payment_status: 'unpaid' } as Stripe.Checkout.Session
  expect(await paidOrderSummary(fakeStripe(pending), 'cs_test_1')).toMatchObject({ total: 879, paid: false })
})

it('returns null for an unpaid platební pokus', async () => {
  expect(await paidOrderSummary(fakeStripe({ ...paid, status: 'open', payment_status: 'unpaid' }), 'cs_test_1')).toBeNull()
  expect(await paidOrderSummary(fakeStripe({ ...paid, status: 'expired', payment_status: 'unpaid' }), 'cs_test_1')).toBeNull()
})

it('returns null for an unknown session id', async () => {
  const missing = new Stripe.errors.StripeInvalidRequestError({ message: 'No such checkout.session', type: 'invalid_request_error' })
  expect(await paidOrderSummary(fakeStripe(missing), 'cs_test_nope')).toBeNull()
})
