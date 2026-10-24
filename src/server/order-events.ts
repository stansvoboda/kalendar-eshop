import type { SanityClient } from '@sanity/client'
import type Stripe from 'stripe'
import { orderFromSession } from './orders'

// Zpracování událostí objednávky: receives already-verified events, does all side effects through ports.

export type Order = ReturnType<typeof orderFromSession>

export interface OrderStore {
  /** Creates the objednávka; false when it already exists (repeated delivery). */
  createOrder(order: Order): Promise<boolean>
}

export interface Payments {
  lineItems(sessionId: string): Promise<Stripe.LineItem[]>
}

export function createOrderEvents({ store, payments }: { store: OrderStore; payments: Payments }) {
  return {
    async zaplaceno(session: Stripe.Checkout.Session) {
      const created = await store.createOrder(orderFromSession(session, await payments.lineItems(session.id)))
      return { created }
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
  }
}

export function stripePayments(stripe: Stripe): Payments {
  return {
    async lineItems(sessionId) {
      const { data } = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 })
      return data
    },
  }
}
