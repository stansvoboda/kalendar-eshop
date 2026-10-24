import { expect, it } from 'vitest'
import type Stripe from 'stripe'
import { createOrderEvents, type OrderStore, type Payments } from './order-events'

function fakeStore() {
  const docs = new Map<string, unknown>()
  const store: OrderStore = {
    async createOrder(order) {
      if (docs.has(order._id)) return false
      docs.set(order._id, order)
      return true
    },
  }
  return { store, docs }
}

const payments: Payments = {
  async lineItems() {
    return [{ id: 'li_1', description: 'Kalendář A', quantity: 2, amount_total: 78_000 }] as Stripe.LineItem[]
  },
}

const session = {
  id: 'cs_test_1',
  created: 1_700_000_000,
  metadata: { name: 'Jan' },
  customer_details: { email: 'jan@example.cz' },
  amount_total: 78_000,
} as unknown as Stripe.Checkout.Session

it('zaplaceno creates the objednávka', async () => {
  const { store, docs } = fakeStore()
  await createOrderEvents({ store, payments }).zaplaceno(session)

  expect([...docs.values()]).toEqual([
    expect.objectContaining({
      _id: 'orders.cs_test_1',
      name: 'Jan',
      total: 780,
      items: [{ _key: 'li_1', name: 'Kalendář A', qty: 2, subtotal: 780 }],
    }),
  ])
})

it('a repeated zaplaceno does not create a duplicate objednávka', async () => {
  const { store, docs } = fakeStore()
  const events = createOrderEvents({ store, payments })
  await events.zaplaceno(session)
  await events.zaplaceno(session)

  expect(docs.size).toBe(1)
})
