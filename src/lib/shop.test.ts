import { describe, expect, it } from 'vitest'
import { addToCart, cartLines, cartSchema, checkoutSchema, setQty } from './shop'
import type { Product } from './shop'

const products: Product[] = [
  { _id: 'a', name: 'Kalendář A', slug: 'a', price: 390, description: null, imageUrl: null },
  { _id: 'b', name: 'Kalendář B', slug: 'b', price: 450, description: null, imageUrl: null },
]

describe('cart', () => {
  it('adds new items and increments existing ones', () => {
    const cart = addToCart(addToCart([], 'a'), 'a', 2)
    expect(cart).toEqual([{ id: 'a', qty: 3 }])
  })

  it('caps quantity at 99 and removes at 0', () => {
    expect(setQty([{ id: 'a', qty: 1 }], 'a', 500)).toEqual([{ id: 'a', qty: 99 }])
    expect(setQty([{ id: 'a', qty: 1 }], 'a', 0)).toEqual([])
  })

  it('prices lines from products and drops unknown ids', () => {
    const lines = cartLines([{ id: 'a', qty: 2 }, { id: 'gone', qty: 1 }], products)
    expect(lines).toHaveLength(1)
    expect(lines[0].subtotal).toBe(780)
  })
})

describe('validation', () => {
  it('rejects empty cart and bad email', () => {
    expect(cartSchema.safeParse([]).success).toBe(false)
    expect(checkoutSchema.safeParse({ name: 'Jan', email: 'nope' }).success).toBe(false)
    expect(checkoutSchema.safeParse({ name: 'Jan', email: 'jan@example.cz' }).success).toBe(true)
  })
})
