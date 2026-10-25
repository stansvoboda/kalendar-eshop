import { Text } from '@react-email/components'
import type { Order } from '#/server/orders'
import { formatCzk } from '#/lib/shop'
import { Layout } from './layout'

export function VraceniPenez({ order, amount, contact }: { order: Order; amount: number; contact: string }) {
  return (
    <Layout preview={`Vrátili jsme vám ${formatCzk(amount)}`} contact={contact}>
      <Text>Dobrý den, {order.name},</Text>
      <Text>k vaší objednávce jsme vám vrátili {formatCzk(amount)}.</Text>
    </Layout>
  )
}
