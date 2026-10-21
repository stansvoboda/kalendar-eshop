import { expect, it } from 'vitest'
import type Stripe from 'stripe'
import { orderFromSession } from './orders'

it('maps a paid Checkout session to a private Sanity order', () => {
  const session = {
    id: 'cs_test_1',
    created: 1_700_000_000,
    metadata: { name: 'Jan' },
    customer_details: { email: 'jan@example.cz' },
    amount_total: 78_000,
  } as unknown as Stripe.Checkout.Session
  const items = [{ id: 'li_1', description: 'Kalendář A', quantity: 2, amount_total: 78_000 }] as Stripe.LineItem[]

  const order = orderFromSession(session, items)
  expect(order._id).toBe('orders.cs_test_1')
  expect(order).toMatchObject({ name: 'Jan', email: 'jan@example.cz', total: 780 })
  expect(order.items).toEqual([{ _key: 'li_1', name: 'Kalendář A', qty: 2, subtotal: 780 }])
})
