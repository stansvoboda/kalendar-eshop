import { createFileRoute, notFound } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { cartStore } from '#/lib/cart-store'
import { addToCart, formatCzk } from '#/lib/shop'
import { productsQuery } from './index'

export const Route = createFileRoute('/produkt/$slug')({
  loader: async ({ context, params }) => {
    const products = await context.queryClient.ensureQueryData(productsQuery)
    const product = products.find((p) => p.slug === params.slug)
    if (!product) throw notFound()
    return product
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.name }] }),
  component: ProductPage,
})

function ProductPage() {
  const p = Route.useLoaderData()
  return (
    <div className="grid gap-8 md:grid-cols-2">
      {p.imageUrl && <img src={`${p.imageUrl}?w=900`} alt={p.name} className="w-full rounded-lg" />}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">{p.name}</h1>
        <p className="text-2xl font-semibold">{formatCzk(p.price)}</p>
        {p.description && <p className="whitespace-pre-line text-muted-foreground">{p.description}</p>}
        <Button onClick={() => cartStore.setState((items) => addToCart(items, p._id))}>Do košíku</Button>
      </div>
    </div>
  )
}
