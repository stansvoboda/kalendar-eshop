import { expect, it } from 'vitest'
import type Stripe from 'stripe'
import { render } from '@react-email/components'
import { createOrderEvents, type Order, type OrderStore, type Payments, type Stock } from './order-events'
import type { Mailer } from './mailer'

function fakeStore() {
  const docs = new Map<string, Order & { sentEmails?: string[] }>()
  const store: OrderStore = {
    async createOrder(order) {
      if (docs.has(order._id)) return false
      docs.set(order._id, order)
      return true
    },
    async getOrder(orderId) {
      return docs.get(orderId) ?? null
    },
    async recordSentEmail(orderId, email) {
      const doc = docs.get(orderId)!
      doc.sentEmails = [...(doc.sentEmails ?? []), email]
    },
    async setStav(orderId, stav) {
      docs.get(orderId)!.stav = stav
    },
  }
  return { store, docs }
}

function fakeStock(initial: Record<string, number>) {
  const levels = new Map(Object.entries(initial))
  const stock: Stock = {
    async decrement(productId, qty) {
      levels.set(productId, (levels.get(productId) ?? 0) - qty)
      return levels.get(productId)!
    },
  }
  return { stock, levels }
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
    return [
      { id: 'li_1', description: 'Kalendář A', quantity: 2, amount_total: 78_000, price: { product: { metadata: { productId: 'a' } } } },
    ] as unknown as Stripe.LineItem[]
  },
  async sessionIdForPaymentIntent(paymentIntentId) {
    return paymentIntentId === 'pi_1' ? 'cs_test_1' : null
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

function setup({ skladem = 10 } = {}) {
  const { store, docs } = fakeStore()
  const { mailer, sent } = fakeMailer()
  const { stock, levels } = fakeStock({ a: skladem })
  return { docs, sent, levels, events: createOrderEvents({ store, payments, mailer, shop, stock }) }
}

it('zaplaceno creates the objednávka', async () => {
  const { events, docs } = setup()
  await events.zaplaceno(session)

  expect([...docs.values()]).toEqual([
    expect.objectContaining({
      _id: 'orders.cs_test_1',
      name: 'Jan',
      total: 879,
      stav: 'zaplacena',
      items: [{ _key: 'li_1', productId: 'a', name: 'Kalendář A', qty: 2, subtotal: 780 }],
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

it('vyrizeno e-mails the kupující that the objednávka was sent to the doručovací adresa', async () => {
  const { events, sent } = setup()
  await events.zaplaceno(session)
  await events.vyrizeno('orders.cs_test_1')

  expect(sent).toHaveLength(3)
  const [, , vyrizena] = sent
  expect(vyrizena.to).toBe('jan@example.cz')
  expect(vyrizena.subject).toContain('Objednávka vyřízena')
  for (const text of ['odeslali', 'Jan Novák', 'Dlouhá 5', '11000 Praha']) expect(vyrizena.text).toContain(text)
})

it('vyrizeno for Osobní odběr says the objednávka is ready for pickup at the odběrní místo', async () => {
  const { events, sent } = setup()
  await events.zaplaceno(odberSession)
  await events.vyrizeno('orders.cs_test_1')

  expect(sent[2].text).toContain('připravená k vyzvednutí')
  expect(sent[2].text).toContain('Dílna, Masarykova 1, Brno')
  expect(sent[2].text).not.toContain('odeslali')
})

it('a repeated vyrizeno sends the e-mail only once', async () => {
  const { events, sent } = setup()
  await events.zaplaceno(session)
  await events.vyrizeno('orders.cs_test_1')
  await events.vyrizeno('orders.cs_test_1')

  expect(sent).toHaveLength(3)
})

it('vyrizeno for an unknown objednávka sends nothing', async () => {
  const { events, sent } = setup()
  await events.vyrizeno('orders.missing')

  expect(sent).toHaveLength(0)
})

it('zaplaceno odečte kusy once, even when the událost repeats', async () => {
  const { events, levels } = setup({ skladem: 5 })
  await events.zaplaceno(session)
  await events.zaplaceno(session)

  expect(levels.get('a')).toBe(3)
})

it('přeprodej creates the objednávka and sends the obchodník an upozornění', async () => {
  const { events, docs, sent, levels } = setup({ skladem: 1 })
  await events.zaplaceno(session)

  expect(docs.size).toBe(1)
  expect(levels.get('a')).toBe(-1)
  const upozorneni = sent.filter((m) => m.subject.includes('Přeprodej'))
  expect(upozorneni.map((m) => m.to)).toEqual(['obchod@example.cz'])
  for (const text of ['Jan', 'Kalendář A', '-1']) expect(upozorneni[0].text).toContain(text)
})

it('no přeprodej upozornění when the last kusy sell out exactly', async () => {
  const { events, sent } = setup({ skladem: 2 })
  await events.zaplaceno(session)

  expect(sent.map((m) => m.subject).join()).not.toContain('Přeprodej')
})

// A charge for `session` (87 900 haléřů) after vrácení of `amountRefunded`; the last refund is re_<amountRefunded>.
function refundedCharge(amountRefunded: number, lastRefund = amountRefunded) {
  return {
    id: 'ch_1',
    payment_intent: 'pi_1',
    amount: 87_900,
    amount_refunded: amountRefunded,
    refunded: amountRefunded === 87_900,
    refunds: { data: [{ id: `re_${amountRefunded}`, amount: lastRefund }] },
  } as unknown as Stripe.Charge
}

it('plné vrácení peněz makes the objednávka Stornovaná and e-mails the kupující o stornu', async () => {
  const { events, docs, sent } = setup()
  await events.zaplaceno(session)
  await events.vracenyPenize(refundedCharge(87_900))

  expect(docs.get('orders.cs_test_1')!.stav).toBe('stornovana')
  expect(sent).toHaveLength(3)
  expect(sent[2].to).toBe('jan@example.cz')
  expect(sent[2].subject).toContain('Objednávka stornována')
  expect(sent[2].text).toContain('879')
})

it('a Vyřízená objednávka can be stornována too', async () => {
  const { events, docs } = setup()
  await events.zaplaceno(session)
  docs.get('orders.cs_test_1')!.stav = 'vyrizena'
  await events.vracenyPenize(refundedCharge(87_900))

  expect(docs.get('orders.cs_test_1')!.stav).toBe('stornovana')
})

it('storno does not return kusy to the sklad', async () => {
  const { events, levels } = setup({ skladem: 5 })
  await events.zaplaceno(session)
  await events.vracenyPenize(refundedCharge(87_900))

  expect(levels.get('a')).toBe(3)
})

it('částečné vrácení keeps the stav and e-mails the vrácená částka', async () => {
  const { events, docs, sent } = setup()
  await events.zaplaceno(session)
  await events.vracenyPenize(refundedCharge(9_900))

  expect(docs.get('orders.cs_test_1')!.stav).toBe('zaplacena')
  expect(sent).toHaveLength(3)
  expect(sent[2].to).toBe('jan@example.cz')
  expect(sent[2].subject).toContain('Vrácení peněz')
  expect(sent[2].text).toContain('99')
})

it('each částečné vrácení sends its own e-mail, naming only that refund', async () => {
  const { events, sent } = setup()
  await events.zaplaceno(session)
  await events.vracenyPenize(refundedCharge(9_900))
  await events.vracenyPenize(refundedCharge(19_900, 10_000))

  expect(sent).toHaveLength(4)
  expect(sent[3].text).toContain('100')
})

it('a repeated vrácení webhook sends no e-mail again', async () => {
  const { events, sent } = setup()
  await events.zaplaceno(session)
  await events.vracenyPenize(refundedCharge(9_900))
  await events.vracenyPenize(refundedCharge(9_900))
  await events.vracenyPenize(refundedCharge(87_900))
  await events.vracenyPenize(refundedCharge(87_900))

  expect(sent).toHaveLength(4)
})

it('vrácení for a charge without an objednávka sends nothing', async () => {
  const { events, sent } = setup()
  await events.vracenyPenize({ ...refundedCharge(87_900), payment_intent: 'pi_other' } as Stripe.Charge)

  expect(sent).toHaveLength(0)
})
