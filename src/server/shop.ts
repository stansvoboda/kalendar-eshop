import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@sanity/client'
import Stripe from 'stripe'
import { cartLines, cartSchema, checkoutSchema, deliveryMethodSchema, deliveryPrice, productSchema } from '#/lib/shop'
import type { DeliveryConfig } from '#/lib/shop'

const PRODUCTS = `*[_type == "product" && defined(slug.current)] | order(name asc) {
  _id, name, "slug": slug.current, price, "description": coalesce(description, null), "imageUrl": coalesce(image.asset->url, null)
}`

// Env is read per request: on Workers it doesn't exist at module load.
async function fetchProducts() {
  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: process.env.SANITY_DATASET ?? 'production',
    apiVersion: '2025-01-01',
    useCdn: true,
  })
  // Skip products with bad data (e.g. price 0) instead of breaking the whole shop.
  const rows: unknown[] = await sanity.fetch(PRODUCTS)
  return rows.flatMap((row) => {
    const parsed = productSchema.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
}

export const getProducts = createServerFn().handler(fetchProducts)

function deliveryConfig(): DeliveryConfig {
  return {
    price: Number(process.env.DELIVERY_PRICE_CZK || 99),
    pickupPlace: process.env.PICKUP_PLACE || 'Osobní odběr po domluvě e-mailem',
  }
}

export const getDeliveryConfig = createServerFn().handler(deliveryConfig)

export const createCheckout = createServerFn({ method: 'POST' })
  .validator(checkoutSchema.extend({ items: cartSchema, delivery: deliveryMethodSchema }))
  .handler(async ({ data }) => {
    const lines = cartLines(data.items, await fetchProducts())
    if (!lines.length) throw new Error('Košík je prázdný')

    const config = deliveryConfig()
    const adresa = data.delivery === 'adresa'
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const origin = new URL(getRequest().url).origin
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: data.email,
      metadata: { name: data.name, delivery: data.delivery },
      line_items: lines.map(({ product, qty }) => ({
        quantity: qty,
        price_data: {
          currency: 'czk',
          unit_amount: product.price * 100,
          product_data: {
            name: product.name,
            metadata: { productId: product._id },
            ...(product.imageUrl && { images: [product.imageUrl] }),
          },
        },
      })),
      ...(adresa && { shipping_address_collection: { allowed_countries: ['CZ'] } }),
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: deliveryPrice(data.delivery, config) * 100, currency: 'czk' },
            display_name: adresa ? 'Doručení na adresu' : `Osobní odběr: ${config.pickupPlace}`,
          },
        },
      ],
      success_url: `${origin}/dekujeme`,
      cancel_url: `${origin}/kosik`,
    })
    return { url: session.url! }
  })
