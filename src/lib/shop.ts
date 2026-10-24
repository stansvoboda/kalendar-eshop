import { z } from 'zod'

export const productSchema = z.object({
  _id: z.string(),
  name: z.string(),
  slug: z.string(),
  // whole CZK, as entered in Sanity Studio
  price: z.number().int().positive(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
})
export type Product = z.infer<typeof productSchema>

export type CartItem = { id: string; qty: number }

export const checkoutSchema = z.object({
  name: z.string().trim().min(2, 'Zadej jméno'),
  email: z.email('Neplatný e-mail'),
})
export type CheckoutInput = z.infer<typeof checkoutSchema>

export const cartSchema = z
  .array(z.object({ id: z.string(), qty: z.number().int().min(1).max(99) }))
  .min(1, 'Košík je prázdný')

// Způsob doručení: 'adresa' = Doručení na adresu, 'odber' = Osobní odběr.
export const deliveryMethodSchema = z.enum(['adresa', 'odber'])
export type DeliveryMethod = z.infer<typeof deliveryMethodSchema>
// From server config; price in whole CZK.
export type DeliveryConfig = { price: number; pickupPlace: string }

export const deliveryPrice = (method: DeliveryMethod, config: DeliveryConfig) =>
  method === 'adresa' ? config.price : 0

export const formatCzk = (czk: number) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(czk)

export function addToCart(items: CartItem[], id: string, qty = 1): CartItem[] {
  const existing = items.find((i) => i.id === id)
  if (!existing) return [...items, { id, qty }]
  return items.map((i) => (i.id === id ? { ...i, qty: Math.min(i.qty + qty, 99) } : i))
}

export function setQty(items: CartItem[], id: string, qty: number): CartItem[] {
  if (qty <= 0) return items.filter((i) => i.id !== id)
  return items.map((i) => (i.id === id ? { ...i, qty: Math.min(qty, 99) } : i))
}

// Joins the cart with server-side products so prices always come from the CMS, never the client.
export function cartLines(items: CartItem[], products: Product[]) {
  return items.flatMap((item) => {
    const product = products.find((p) => p._id === item.id)
    return product ? [{ product, qty: item.qty, subtotal: product.price * item.qty }] : []
  })
}

export function cartTotal(lines: { subtotal: number }[], method: DeliveryMethod, config: DeliveryConfig) {
  return lines.reduce((sum, l) => sum + l.subtotal, deliveryPrice(method, config))
}
