import type { SanityClient } from '@sanity/client'
import Stripe from 'stripe'
import { createElement } from 'react'
import { orderFromSession, type Order, type OrderStav } from './orders'
import { resendMailer, type Mailer } from './mailer'
import { deliveryConfig, sanityClient } from './shop'
import { ObjednavkaPrijata } from '#/emails/objednavka-prijata'
import { NovaObjednavka } from '#/emails/nova-objednavka'
import { ObjednavkaVyrizena } from '#/emails/objednavka-vyrizena'
import { Preprodej } from '#/emails/preprodej'
import { ObjednavkaStornovana } from '#/emails/objednavka-stornovana'
import { VraceniPenez } from '#/emails/vraceni-penez'

// Zpracování událostí objednávky: receives already-verified events, does all side effects through ports.

// sentEmails: keys of steps already done for this objednávka (e-mails like 'vyrizeno', odečty like 'sklad:<productId>:<left>' or 'sklad:<productId>:smazan'),
// for idempotency on webhook retries. Named before it held odečty; kept so existing documents still work.
export type StoredOrder = Order & { sentEmails?: string[] }

export interface OrderStore {
  /** Creates the objednávka; false when it already exists (repeated delivery). */
  createOrder(order: Order): Promise<boolean>
  getOrder(orderId: string): Promise<StoredOrder | null>
  recordSentEmail(orderId: string, email: string): Promise<void>
  setStav(orderId: string, stav: OrderStav): Promise<void>
}

export interface Stock {
  /**
   * Subtracts kusy skladem and records the odečet as 'sklad:<productId>:<left>' on the objednávka in one atomic write
   * (left < 0 = přeprodej; 'smazan' for a product deleted from the katalog). Throws when either changed meanwhile.
   */
  decrement(orderId: string, productId: string, qty: number): Promise<void>
}

export interface Payments {
  lineItems(sessionId: string): Promise<Stripe.LineItem[]>
  /** The Checkout Session behind the payment intent (and so the objednávka); null when none. */
  sessionIdForPaymentIntent(paymentIntentId: string): Promise<string | null>
}

// From server config; merchantEmail also serves as the contact in every e-mail's footer.
export type ShopConfig = { merchantEmail: string; pickupPlace: string }

export function createOrderEvents({
  store,
  payments,
  mailer,
  shop,
  stock,
}: {
  store: OrderStore
  stock: Stock
  payments: Payments
  mailer: Mailer
  shop: ShopConfig
}) {
  // Sends unless the objednávka's record says it was sent; a failed send is retried on the next delivery.
  // Concurrent deliveries can both pass the check and send twice; add an ifRevisionId check if that shows up.
  async function sendOnce(order: StoredOrder, key: string, mail: Parameters<Mailer['send']>[0]) {
    if (order.sentEmails?.includes(key)) return
    await mailer.send(mail)
    await store.recordSentEmail(order._id, key)
  }

  return {
    // Every delivery runs the steps not yet done, so a Stripe retry finishes what a failed delivery left (story 38).
    async zaplaceno(session: Stripe.Checkout.Session) {
      const fresh = orderFromSession(session, await payments.lineItems(session.id))
      await store.createOrder(fresh)
      const order = (await store.getOrder(fresh._id))!
      // Kusy first: a failed e-mail must not leave them un-subtracted. The key keeps the new count for the přeprodej upozornění.
      for (const item of order.items) {
        if (!item.productId || order.sentEmails?.some((k) => k.startsWith(`sklad:${item.productId}:`))) continue
        await stock.decrement(order._id, item.productId, item.qty)
      }
      const done = (await store.getOrder(order._id))!
      const oversold = order.items.flatMap((item) => {
        const key = done.sentEmails?.find((k) => k.startsWith(`sklad:${item.productId}:`))
        const left = Number(key?.split(':')[2])
        return left < 0 ? [{ name: item.name, stock: left }] : []
      })
      const props = { order, pickupPlace: shop.pickupPlace, contact: shop.merchantEmail }
      await sendOnce(done, 'prijata', { to: order.email, subject: 'Objednávka přijata', react: createElement(ObjednavkaPrijata, props) })
      await sendOnce(done, 'nova', {
        to: shop.merchantEmail,
        subject: `Nová objednávka: ${order.name}, ${order.total} Kč`,
        react: createElement(NovaObjednavka, props),
      })
      if (oversold.length)
        await sendOnce(done, 'preprodej', {
          to: shop.merchantEmail,
          subject: `Přeprodej: objednávka od ${order.name}`,
          react: createElement(Preprodej, { order, oversold, contact: shop.merchantEmail }),
        })
    },

    async vyrizeno(orderId: string) {
      const order = await store.getOrder(orderId)
      if (!order) return
      await sendOnce(order, 'vyrizeno', {
        to: order.email,
        subject: 'Objednávka vyřízena',
        react: createElement(ObjednavkaVyrizena, { order, pickupPlace: shop.pickupPlace, contact: shop.merchantEmail }),
      })
    },

    // Storno (ADR 0001): full vrácení makes the objednávka Stornovaná from any stav; kusy stay subtracted.
    // The charge must carry its refunds (newest first), e.g. retrieved with `expand: ['refunds']`.
    async vracenyPenize(charge: Stripe.Charge) {
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
      const sessionId = paymentIntentId && (await payments.sessionIdForPaymentIntent(paymentIntentId))
      const order = sessionId && (await store.getOrder(`orders.${sessionId}`))
      if (!order) return
      if (charge.refunded) {
        if (order.stav !== 'stornovana') await store.setStav(order._id, 'stornovana')
        await sendOnce(order, 'storno', {
          to: order.email,
          subject: 'Objednávka stornována',
          react: createElement(ObjednavkaStornovana, { order, contact: shop.merchantEmail }),
        })
        return
      }
      // shortcut: if two partial refunds' webhooks both fetch the charge after the second one, only the newest is mailed; mail every unmailed refund if that matters.
      const refund = charge.refunds?.data[0]
      if (!refund) return
      await sendOnce(order, `vraceni:${refund.id}`, {
        to: order.email,
        subject: 'Vrácení peněz k objednávce',
        react: createElement(VraceniPenez, { order, amount: refund.amount / 100, contact: shop.merchantEmail }),
      })
    },
  }
}

export function sanityOrderStore(sanity: SanityClient): OrderStore {
  return {
    async createOrder(order) {
      try {
        await sanity.create(order)
        return true
      } catch (err) {
        // Stripe retries deliveries; the session id is the order id, so a retry hits 409.
        if ((err as { statusCode?: number }).statusCode === 409) return false
        throw err
      }
    },
    async getOrder(orderId) {
      return sanity.getDocument<StoredOrder>(orderId).then((doc) => doc ?? null)
    },
    async recordSentEmail(orderId, email) {
      await sanity.patch(orderId).setIfMissing({ sentEmails: [] }).append('sentEmails', [email]).commit()
    },
    async setStav(orderId, stav) {
      await sanity.patch(orderId).set({ stav }).commit()
    },
  }
}

export function sanityStock(sanity: SanityClient): Stock {
  return {
    // Both revisions are checked, so a concurrent delivery or sale makes this throw (409) and Stripe retries the webhook.
    async decrement(orderId, productId, qty) {
      const [order, product] = await Promise.all([
        sanity.getDocument<StoredOrder>(orderId),
        sanity.getDocument<{ stock?: number }>(productId),
      ])
      if (!order) throw new Error(`Objednávka ${orderId} not found`)
      const prefix = `sklad:${productId}:`
      if (order.sentEmails?.some((k) => k.startsWith(prefix))) return
      const left = product ? (product.stock ?? 0) - qty : 'smazan'
      const tx = sanity
        .transaction()
        .patch(orderId, (p) => p.ifRevisionId(order._rev).setIfMissing({ sentEmails: [] }).append('sentEmails', [prefix + left]))
      if (product) tx.patch(productId, (p) => p.ifRevisionId(product._rev).set({ stock: left }))
      await tx.commit()
    },
  }
}

export function stripePayments(stripe: Stripe): Payments {
  return {
    async lineItems(sessionId) {
      const { data } = await stripe.checkout.sessions.listLineItems(sessionId, {
        limit: 100,
        expand: ['data.price.product'],
      })
      return data
    },
    async sessionIdForPaymentIntent(paymentIntentId) {
      const { data } = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 })
      return data[0]?.id ?? null
    },
  }
}

// Zpracování událostí objednávky wired to Sanity, Stripe and Resend, for the webhooks.
export function orderEventsFromEnv(stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)) {
  const sanity = sanityClient({ write: true })
  return createOrderEvents({
    store: sanityOrderStore(sanity),
    stock: sanityStock(sanity),
    payments: stripePayments(stripe),
    mailer: resendMailer(process.env.RESEND_API_KEY!, process.env.EMAIL_FROM || 'Kalendáře <onboarding@resend.dev>'),
    shop: { merchantEmail: process.env.MERCHANT_EMAIL!, pickupPlace: deliveryConfig().pickupPlace },
  })
}
