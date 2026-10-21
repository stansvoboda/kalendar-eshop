import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@sanity/client'
import Stripe from 'stripe'
import { cartLines, cartSchema, checkoutSchema, productSchema } from '#/lib/shop'

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

export const createCheckout = createServerFn({ method: 'POST' })
  .validator(checkoutSchema.extend({ items: cartSchema }))
  .handler(async ({ data }) => {
    const lines = cartLines(data.items, await fetchProducts())
    if (!lines.length) throw new Error('Košík je prázdný')

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const origin = new URL(getRequest().url).origin
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: data.email,
      metadata: { name: data.name },
      line_items: lines.map(({ product, qty }) => ({
        quantity: qty,
        price_data: {
          currency: 'czk',
          unit_amount: product.price * 100,
          product_data: { name: product.name, ...(product.imageUrl && { images: [product.imageUrl] }) },
        },
      })),
      success_url: `${origin}/dekujeme`,
      cancel_url: `${origin}/kosik`,
    })
    return { url: session.url! }
  })
