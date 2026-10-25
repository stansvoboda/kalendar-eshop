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

const lineItem = {
  id: 'li_1',
  description: 'Kalendář A',
  quantity: 2,
  amount_total: 78_000,
  price: { product: { metadata: { productId: 'prod-a' } } },
} as unknown as Stripe.LineItem

it('maps Doručení na adresu with address, delivery price and produkt id per item', () => {
  const session = {
    id: 'cs_test_2',
    created: 1_700_000_000,
    metadata: { name: 'Jan', delivery: 'adresa' },
    customer_details: { email: 'jan@example.cz' },
    amount_total: 78_000 + 9_900,
    shipping_cost: { amount_total: 9_900 },
    collected_information: {
      shipping_details: {
        name: 'Jan Novák',
        address: { line1: 'Dlouhá 1', line2: null, city: 'Praha', postal_code: '11000', country: 'CZ', state: null },
      },
    },
  } as unknown as Stripe.Checkout.Session

  expect(orderFromSession(session, [lineItem])).toMatchObject({
    total: 879,
    delivery: 'adresa',
    deliveryPrice: 99,
    address: { name: 'Jan Novák', line1: 'Dlouhá 1', line2: '', city: 'Praha', postalCode: '11000', country: 'CZ' },
    items: [{ _key: 'li_1', productId: 'prod-a', name: 'Kalendář A', qty: 2, subtotal: 780 }],
  })
})

it('maps Osobní odběr without address and with free delivery', () => {
  const session = {
    id: 'cs_test_3',
    created: 1_700_000_000,
    metadata: { name: 'Jan', delivery: 'odber' },
    customer_details: { email: 'jan@example.cz' },
    amount_total: 78_000,
    shipping_cost: { amount_total: 0 },
    collected_information: { shipping_details: null },
  } as unknown as Stripe.Checkout.Session

  const order = orderFromSession(session, [lineItem])
  expect(order).toMatchObject({ delivery: 'odber', deliveryPrice: 0 })
  expect(order.address).toBeUndefined()
})
