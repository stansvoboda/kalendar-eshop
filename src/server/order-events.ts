import type { SanityClient } from '@sanity/client'
import type Stripe from 'stripe'
import { createElement } from 'react'
import { orderFromSession } from './orders'
import type { Mailer } from './mailer'
import { ObjednavkaPrijata } from '#/emails/objednavka-prijata'
import { NovaObjednavka } from '#/emails/nova-objednavka'
import { ObjednavkaVyrizena } from '#/emails/objednavka-vyrizena'
import { Preprodej } from '#/emails/preprodej'

// Zpracování událostí objednávky: receives already-verified events, does all side effects through ports.

export type Order = ReturnType<typeof orderFromSession>

// sentEmails: keys of kupující e-mails already sent for this objednávka ('vyrizeno', …), for idempotency on webhook retries.
export type StoredOrder = Order & { sentEmails?: string[] }

export interface OrderStore {
  /** Creates the objednávka; false when it already exists (repeated delivery). */
  createOrder(order: Order): Promise<boolean>
  getOrder(orderId: string): Promise<StoredOrder | null>
  recordSentEmail(orderId: string, email: string): Promise<void>
}

export interface Stock {
  /** Atomically subtracts kusy skladem; returns the new count (negative = přeprodej). */
  decrement(productId: string, qty: number): Promise<number>
}

export interface Payments {
  lineItems(sessionId: string): Promise<Stripe.LineItem[]>
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
  // Sends unless the objednávka's record says it was sent. shortcut: two truly concurrent deliveries can both send; add an ifRevisionId check if that shows up.
  async function sendOnce(order: StoredOrder, email: string, mail: Parameters<Mailer['send']>[0]) {
    if (order.sentEmails?.includes(email)) return
    await mailer.send(mail)
    await store.recordSentEmail(order._id, email)
  }

  return {
    async zaplaceno(session: Stripe.Checkout.Session) {
      const order = orderFromSession(session, await payments.lineItems(session.id))
      const created = await store.createOrder(order)
      // Only the first delivery sends e-mails; a retry after a failed send won't resend (shortcut: no per-e-mail record yet).
      if (created) {
        // Before e-mails: a failed send must not leave kusy un-subtracted, and a retry won't subtract again.
        const oversold = []
        for (const item of order.items) {
          if (!item.productId) continue
          const left = await stock.decrement(item.productId, item.qty)
          if (left < 0) oversold.push({ name: item.name, stock: left })
        }
        const props = { order, pickupPlace: shop.pickupPlace, contact: shop.merchantEmail }
        await mailer.send({ to: order.email, subject: 'Objednávka přijata', react: createElement(ObjednavkaPrijata, props) })
        await mailer.send({
          to: shop.merchantEmail,
          subject: `Nová objednávka: ${order.name}, ${order.total} Kč`,
          react: createElement(NovaObjednavka, props),
        })
        if (oversold.length)
          await mailer.send({
            to: shop.merchantEmail,
            subject: `Přeprodej: objednávka od ${order.name}`,
            react: createElement(Preprodej, { order, oversold, contact: shop.merchantEmail }),
          })
      }
      return { created }
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
  }
}

export function sanityStock(sanity: SanityClient): Stock {
  return {
    async decrement(productId, qty) {
      const doc = await sanity.patch(productId).setIfMissing({ stock: 0 }).dec({ stock: qty }).commit<{ stock: number }>()
      return doc.stock
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
  }
}
