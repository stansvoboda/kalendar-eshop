import type Stripe from 'stripe'

// The dot in the _id keeps orders private even though the dataset is public.
export function orderFromSession(session: Stripe.Checkout.Session, lineItems: Stripe.LineItem[]) {
  return {
    _id: `orders.${session.id}`,
    _type: 'order' as const,
    stripeSessionId: session.id,
    createdAt: new Date(session.created * 1000).toISOString(),
    name: session.metadata?.name ?? session.customer_details?.name ?? '',
    email: session.customer_details?.email ?? session.customer_email ?? '',
    total: (session.amount_total ?? 0) / 100,
    items: lineItems.map((li) => ({
      _key: li.id,
      name: li.description ?? '',
      qty: li.quantity ?? 1,
      subtotal: li.amount_total / 100,
    })),
  }
}
