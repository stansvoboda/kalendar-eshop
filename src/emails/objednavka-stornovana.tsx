import { Text } from '@react-email/components'
import type { Order } from '#/server/order-events'
import { formatCzk } from '#/lib/shop'
import { Layout } from './layout'

export function ObjednavkaStornovana({ order, contact }: { order: Order; contact: string }) {
  return (
    <Layout preview="Vaše objednávka je stornovaná" contact={contact}>
      <Text>Dobrý den, {order.name},</Text>
      <Text>vaši objednávku jsme stornovali a vrátili vám celou částku {formatCzk(order.total)}.</Text>
    </Layout>
  )
}
