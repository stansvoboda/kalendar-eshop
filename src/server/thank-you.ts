import Stripe from 'stripe'
import { stripePayments } from './order-events'
import { orderFromSession } from './orders'

/** Shrnutí for the „Děkujeme“ page, or null when the session is unknown or not paid. */
export async function paidOrderSummary(stripe: Stripe, sessionId: string) {
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) return null
    throw err
  }
  if (session.payment_status !== 'paid') return null
  // Only what the page shows: the id is in the URL, so no name, e-mail or adresa.
  const { items, delivery, deliveryPrice, total } = orderFromSession(
    session,
    await stripePayments(stripe).lineItems(session.id),
  )
  return { items, delivery, deliveryPrice, total }
}
