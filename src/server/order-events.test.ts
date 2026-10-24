import { expect, it } from 'vitest'
import type Stripe from 'stripe'
import { render } from '@react-email/components'
import { createOrderEvents, type OrderStore, type Payments } from './order-events'
import type { Mailer } from './mailer'

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

// Keeps each e-mail as plain text so tests check the údaje, not the markup.
function fakeMailer() {
  const sent: { to: string; subject: string; text: string }[] = []
  const mailer: Mailer = {
    async send({ to, subject, react }) {
      sent.push({ to, subject, text: await render(react, { plainText: true }) })
    },
  }
  return { mailer, sent }
}

const payments: Payments = {
  async lineItems() {
    return [{ id: 'li_1', description: 'Kalendář A', quantity: 2, amount_total: 78_000 }] as Stripe.LineItem[]
  },
}

const shop = { merchantEmail: 'obchod@example.cz', pickupPlace: 'Dílna, Masarykova 1, Brno' }

const session = {
  id: 'cs_test_1',
  created: 1_700_000_000,
  metadata: { name: 'Jan', delivery: 'adresa' },
  customer_details: { email: 'jan@example.cz' },
  amount_total: 87_900,
  shipping_cost: { amount_total: 9_900 },
  collected_information: {
    shipping_details: {
      name: 'Jan Novák',
      address: { line1: 'Dlouhá 5', line2: null, city: 'Praha', postal_code: '11000', country: 'CZ' },
    },
  },
} as unknown as Stripe.Checkout.Session

const odberSession = {
  ...session,
  metadata: { name: 'Jan', delivery: 'odber' },
  amount_total: 78_000,
  shipping_cost: { amount_total: 0 },
  collected_information: null,
} as unknown as Stripe.Checkout.Session

function setup() {
  const { store, docs } = fakeStore()
  const { mailer, sent } = fakeMailer()
  return { docs, sent, events: createOrderEvents({ store, payments, mailer, shop }) }
}

it('zaplaceno creates the objednávka', async () => {
  const { events, docs } = setup()
  await events.zaplaceno(session)

  expect([...docs.values()]).toEqual([
    expect.objectContaining({
      _id: 'orders.cs_test_1',
      name: 'Jan',
      total: 879,
      items: [{ _key: 'li_1', name: 'Kalendář A', qty: 2, subtotal: 780 }],
    }),
  ])
})

it('zaplaceno e-mails Objednávka přijata to the kupující and Nová objednávka to the obchodník', async () => {
  const { events, sent } = setup()
  await events.zaplaceno(session)

  expect(sent.map((m) => m.to)).toEqual(['jan@example.cz', 'obchod@example.cz'])
  const [prijata, nova] = sent
  expect(prijata.subject).toContain('Objednávka přijata')
  for (const text of ['Kalendář A', '2 ×', '780', 'Doručení na adresu', '99', 'Jan Novák', 'Dlouhá 5', '11000 Praha', '879'])
    expect(prijata.text).toContain(text)
  expect(nova.subject).toContain('Nová objednávka')
  for (const text of ['Jan', 'jan@example.cz', '879', 'Kalendář A']) expect(nova.text).toContain(text)
})

it('Objednávka přijata for Osobní odběr names the odběrní místo', async () => {
  const { events, sent } = setup()
  await events.zaplaceno(odberSession)

  expect(sent[0].text).toContain('Osobní odběr')
  expect(sent[0].text).toContain('Dílna, Masarykova 1, Brno')
})

it('a repeated zaplaceno creates no duplicate objednávka and sends no e-mails again', async () => {
  const { events, docs, sent } = setup()
  await events.zaplaceno(session)
  await events.zaplaceno(session)

  expect(docs.size).toBe(1)
  expect(sent).toHaveLength(2)
})
