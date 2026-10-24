import type Stripe from 'stripe'
import { deliveryMethodSchema } from '#/lib/shop'

// Missing stav (orders created before stav existed) means zaplacena.
export type OrderStav = 'zaplacena' | 'vyrizena' | 'stornovana'

// The dot in the _id keeps orders private even though the dataset is public.
// Line items must be listed with `expand: ['data.price.product']` to carry the produkt id.
export function orderFromSession(session: Stripe.Checkout.Session, lineItems: Stripe.LineItem[]) {
  const shipping = session.collected_information?.shipping_details
  return {
    _id: `orders.${session.id}`,
    _type: 'order' as const,
    stripeSessionId: session.id,
    stav: 'zaplacena' as OrderStav,
    createdAt: new Date(session.created * 1000).toISOString(),
    name: session.metadata?.name ?? session.customer_details?.name ?? '',
    email: session.customer_details?.email ?? session.customer_email ?? '',
    total: (session.amount_total ?? 0) / 100,
    delivery: deliveryMethodSchema.safeParse(session.metadata?.delivery).data,
    deliveryPrice: (session.shipping_cost?.amount_total ?? 0) / 100,
    address: shipping
      ? {
          name: shipping.name,
          line1: shipping.address.line1 ?? '',
          line2: shipping.address.line2 ?? '',
          city: shipping.address.city ?? '',
          postalCode: shipping.address.postal_code ?? '',
          country: shipping.address.country ?? '',
        }
      : undefined,
    items: lineItems.map((li) => {
      const product = li.price?.product
      return {
        _key: li.id,
        productId: typeof product === 'object' && !product.deleted ? product.metadata.productId : undefined,
        name: li.description ?? '',
        qty: li.quantity ?? 1,
        subtotal: li.amount_total / 100,
      }
    }),
  }
}
