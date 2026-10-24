import { createStore } from '@tanstack/react-store'
import { cartSchema, deliveryMethodSchema } from './shop'
import type { CartItem, DeliveryMethod } from './shop'

const KEY = 'cart'
const DELIVERY_KEY = 'delivery'

export const cartStore = createStore<CartItem[]>([])
export const deliveryStore = createStore<DeliveryMethod>('adresa')

// Called once on the client after hydration; SSR always renders an empty cart.
export function hydrateCart() {
  try {
    const parsed = cartSchema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
    if (parsed.success) cartStore.setState(() => parsed.data)
    const delivery = deliveryMethodSchema.safeParse(localStorage.getItem(DELIVERY_KEY))
    if (delivery.success) deliveryStore.setState(() => delivery.data)
  } catch {}
  cartStore.subscribe((items) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items))
    } catch {}
  })
  deliveryStore.subscribe((method) => {
    try {
      localStorage.setItem(DELIVERY_KEY, method)
    } catch {}
  })
}

// Also clears storage: on a full page load this runs before hydrateCart, which would restore the old cart.
export function clearCart() {
  cartStore.setState(() => [])
  try {
    localStorage.setItem(KEY, '[]')
  } catch {}
}
