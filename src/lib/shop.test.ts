import { describe, expect, it } from 'vitest'
import { addToCart, cartLines, publicProduct, cartSchema, cartTotal, checkoutSchema, deliveryMethodSchema, setQty, stockProblems } from './shop'
import type { Product } from './shop'

const products: Product[] = [
  { _id: 'a', name: 'Kalendář A', slug: 'a', price: 390, description: null, imageUrl: null, stock: 3 },
  { _id: 'b', name: 'Kalendář B', slug: 'b', price: 450, description: null, imageUrl: null, stock: 0 },
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

describe('cart total', () => {
  const lines = cartLines([{ id: 'a', qty: 2 }, { id: 'b', qty: 1 }], products)
  const delivery = { price: 99, pickupPlace: 'Praha' }

  it('adds one fixed delivery price for Doručení na adresu regardless of kusy', () => {
    expect(cartTotal(lines, 'adresa', delivery)).toBe(390 * 2 + 450 + 99)
  })

  it('Osobní odběr is free', () => {
    expect(cartTotal(lines, 'odber', delivery)).toBe(1230)
  })
})

describe('stock check', () => {
  it('flags položky with more kusů in the košík than skladem', () => {
    const lines = cartLines([{ id: 'a', qty: 4 }, { id: 'b', qty: 1 }], products)
    expect(stockProblems(lines).map((l) => [l.product._id, l.qty, l.product.stock])).toEqual([
      ['a', 4, 3],
      ['b', 1, 0],
    ])
  })

  it('accepts a košík that fits the sklad exactly', () => {
    expect(stockProblems(cartLines([{ id: 'a', qty: 3 }], products))).toEqual([])
  })
})

describe('katalog for the browser', () => {
  it('shows only Skladem / Vyprodáno, never the number of kusů', () => {
    expect(publicProduct(products[0])).toEqual({ _id: 'a', name: 'Kalendář A', slug: 'a', price: 390, description: null, imageUrl: null, inStock: true })
    expect(publicProduct({ ...products[0], stock: -2 }).inStock).toBe(false)
  })
})

describe('validation', () => {
  it('accepts only known způsoby doručení', () => {
    expect(deliveryMethodSchema.safeParse('adresa').success).toBe(true)
    expect(deliveryMethodSchema.safeParse('odber').success).toBe(true)
    expect(deliveryMethodSchema.safeParse('dron').success).toBe(false)
  })

  it('rejects empty cart and bad email', () => {
    expect(cartSchema.safeParse([]).success).toBe(false)
    expect(checkoutSchema.safeParse({ name: 'Jan', email: 'nope' }).success).toBe(false)
    expect(checkoutSchema.safeParse({ name: 'Jan', email: 'jan@example.cz' }).success).toBe(true)
  })
})
