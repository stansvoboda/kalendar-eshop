import { createFileRoute, Link } from '@tanstack/react-router'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { cartStore } from '#/lib/cart-store'
import { addToCart, formatCzk } from '#/lib/shop'
import { getProducts } from '#/server/shop'

export const productsQuery = queryOptions({ queryKey: ['products'], queryFn: () => getProducts() })

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  component: Home,
})

function Home() {
  const { data: products } = useSuspenseQuery(productsQuery)
  if (!products.length) return <p>Zatím tu nic není. Přidej produkty v Sanity Studiu.</p>

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <Card key={p._id}>
          <CardHeader>
            <Link to="/produkt/$slug" params={{ slug: p.slug }}>
              {p.imageUrl && (
                <img src={`${p.imageUrl}?w=600&h=600&fit=crop`} alt={p.name} className="mb-4 aspect-square w-full rounded-md object-cover" />
              )}
              <CardTitle>{p.name}</CardTitle>
            </Link>
          </CardHeader>
          <CardContent className="flex items-center justify-between font-semibold">
            {formatCzk(p.price)}
            <Badge variant={p.stock > 0 ? 'secondary' : 'outline'}>{p.stock > 0 ? 'Skladem' : 'Vyprodáno'}</Badge>
          </CardContent>
          <CardFooter>
            <Button disabled={p.stock <= 0} onClick={() => cartStore.setState((items) => addToCart(items, p._id))}>
              Do košíku
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
