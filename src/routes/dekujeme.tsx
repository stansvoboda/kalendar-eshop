import { useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { clearCart } from '#/lib/cart-store'
import { deliveryLabel, formatCzk } from '#/lib/shop'
import { getPaidOrder } from '#/server/shop'

export const Route = createFileRoute('/dekujeme')({
  validateSearch: z.object({ session_id: z.string().optional() }),
  loaderDeps: ({ search }) => ({ sessionId: search.session_id }),
  loader: ({ deps: { sessionId } }) => (sessionId ? getPaidOrder({ data: { sessionId } }) : null),
  head: () => ({ meta: [{ title: 'Děkujeme' }] }),
  component: ThankYou,
})

function ThankYou() {
  const order = Route.useLoaderData()
  useEffect(() => {
    if (order) clearCart()
  }, [order])

  if (!order)
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold">Platba neproběhla</h1>
        <p>Objednávku se nepodařilo zaplatit. Košík ti zůstal, můžeš to zkusit znovu.</p>
        <Link to="/kosik" className="underline">
          Zpět do košíku
        </Link>
      </div>
    )

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-center text-3xl font-bold">Děkujeme za objednávku!</h1>
      <ul className="divide-y">
        {order.items.map((item) => (
          <li key={item._key} className="flex justify-between gap-4 py-3">
            <span className="flex-1">
              {item.name} × {item.qty}
            </span>
            <span>{formatCzk(item.subtotal)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-4 py-3">
          <span>{deliveryLabel(order.delivery)}</span>
          <span>{order.deliveryPrice ? formatCzk(order.deliveryPrice) : 'Zdarma'}</span>
        </li>
        <li className="flex justify-between py-3 font-bold">
          <span>Celkem</span>
          <span>{formatCzk(order.total)}</span>
        </li>
      </ul>
      <p className="text-center">
        <Link to="/" className="underline">
          Zpět do obchodu
        </Link>
      </p>
    </div>
  )
}
