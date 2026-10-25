import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import { useForm } from '@tanstack/react-form'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { cartStore, deliveryStore } from '#/lib/cart-store'
import { cartLines, cartTotal, checkoutSchema, deliveryLabel, deliveryPrice, formatCzk, setQty } from '#/lib/shop'
import { createCheckout, getDeliveryConfig, getStockProblems } from '#/server/shop'
import { productsQuery } from './index'

const deliveryQuery = queryOptions({ queryKey: ['delivery'], queryFn: () => getDeliveryConfig() })

export const Route = createFileRoute('/kosik')({
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(productsQuery), context.queryClient.ensureQueryData(deliveryQuery)]),
  head: () => ({ meta: [{ title: 'Košík' }] }),
  component: CartPage,
})

function CartPage() {
  const { data: products } = useSuspenseQuery(productsQuery)
  const { data: deliveryConfig } = useSuspenseQuery(deliveryQuery)
  const items = useSelector(cartStore)
  const delivery = useSelector(deliveryStore)
  const lines = cartLines(items, products)
  const total = cartTotal(lines, delivery, deliveryConfig)
  // Checked on the server so the browser never learns kusy skladem; until it answers, payment waits.
  const { data: problems } = useQuery({
    queryKey: ['stockProblems', items],
    queryFn: () => getStockProblems({ data: items }),
    enabled: items.length > 0,
  })
  const queryClient = useQueryClient()
  const [checkoutError, setCheckoutError] = useState('')

  const form = useForm({
    defaultValues: { name: '', email: '' },
    validators: { onChange: checkoutSchema },
    onSubmit: async ({ value }) => {
      setCheckoutError('')
      try {
        const { url } = await createCheckout({ data: { ...value, items, delivery: deliveryStore.state } })
        window.location.href = url
      } catch (err) {
        setCheckoutError((err as Error).message)
        // Sklad may have changed since the košík loaded; recheck so the problémové položky show.
        await queryClient.invalidateQueries({ queryKey: ['stockProblems'] })
        await queryClient.invalidateQueries({ queryKey: productsQuery.queryKey })
      }
    },
  })

  if (!lines.length) return <p>Košík je prázdný.</p>

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <ul className="divide-y">
        {lines.map(({ product, qty, subtotal }) => (
          <li key={product._id} className="flex items-center justify-between gap-4 py-3">
            <span className="flex-1">
              {product.name}
              {problems?.includes(product._id) && (
                <span className="block text-sm text-destructive">
                  {product.inStock ? 'Skladem není dost kusů' : 'Vyprodáno'}
                </span>
              )}
            </span>
            <Input
              type="number"
              min={0}
              max={99}
              defaultValue={qty}
              aria-label={`Počet: ${product.name}`}
              className="w-20"
              onChange={(e) => {
                // Number('') is 0, which would remove the položka while the user is retyping
                if (e.target.value === '') return
                cartStore.setState((all) => setQty(all, product._id, Number(e.target.value)))
              }}
              // Uncontrolled so the field can be empty while typing; shows the stored počet again afterwards.
              onBlur={(e) => (e.target.value = String(qty))}
            />
            <span className="w-24 text-right">{formatCzk(subtotal)}</span>
          </li>
        ))}
        <li className="py-3">
          <fieldset className="space-y-2">
            <legend className="mb-2 font-medium">Způsob doručení</legend>
            {(
              [
                ['adresa', ''],
                ['odber', deliveryConfig.pickupPlace],
              ] as const
            ).map(([method, note]) => (
              <label key={method} className="flex items-start gap-2">
                <input
                  type="radio"
                  name="delivery"
                  className="mt-1"
                  checked={delivery === method}
                  onChange={() => deliveryStore.setState(() => method)}
                />
                <span className="flex-1">
                  {deliveryLabel(method)}
                  {note && <span className="block text-sm text-muted-foreground">{note}</span>}
                </span>
                <span className="w-24 text-right">
                  {deliveryPrice(method, deliveryConfig) ? formatCzk(deliveryPrice(method, deliveryConfig)) : 'Zdarma'}
                </span>
              </label>
            ))}
          </fieldset>
        </li>
        <li className="flex justify-between py-3 font-bold">
          <span>Celkem</span>
          <span>{formatCzk(total)}</span>
        </li>
      </ul>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        {(['name', 'email'] as const).map((name) => (
          <form.Field key={name} name={name}>
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor={name}>{name === 'name' ? 'Jméno' : 'E-mail'}</Label>
                <Input
                  id={name}
                  type={name === 'email' ? 'email' : 'text'}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={!!field.state.meta.errors.length}
                />
                {field.state.meta.isTouched && field.state.meta.errors[0] && (
                  <p className="text-sm text-destructive">{field.state.meta.errors[0].message}</p>
                )}
              </div>
            )}
          </form.Field>
        ))}
        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting || !problems || problems.length > 0}>
              {isSubmitting ? 'Přesměrovávám…' : 'Zaplatit'}
            </Button>
          )}
        </form.Subscribe>
        {checkoutError && (
          <p role="alert" className="text-sm text-destructive">
            {checkoutError}
          </p>
        )}
        <p className="text-sm text-muted-foreground">Testovací režim: karta 4242 4242 4242 4242, libovolné datum a CVC.</p>
      </form>
    </div>
  )
}
