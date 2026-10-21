import { createStore } from '@tanstack/react-store'
import { cartSchema } from './shop'
import type { CartItem } from './shop'

const KEY = 'cart'

export const cartStore = createStore<CartItem[]>([])

// Called once on the client after hydration; SSR always renders an empty cart.
export function hydrateCart() {
  try {
    const parsed = cartSchema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
    if (parsed.success) cartStore.setState(() => parsed.data)
  } catch {}
  cartStore.subscribe((items) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items))
    } catch {}
  })
}
