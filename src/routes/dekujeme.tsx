import { useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { cartStore } from '#/lib/cart-store'

export const Route = createFileRoute('/dekujeme')({
  head: () => ({ meta: [{ title: 'Děkujeme' }] }),
  component: ThankYou,
})

function ThankYou() {
  useEffect(() => cartStore.setState(() => []), [])
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-3xl font-bold">Děkujeme za objednávku!</h1>
      <Link to="/" className="underline">
        Zpět do obchodu
      </Link>
    </div>
  )
}
