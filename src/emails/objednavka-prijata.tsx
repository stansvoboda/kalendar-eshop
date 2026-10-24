import { Text } from '@react-email/components'
import type { Order } from '#/server/orders'
import { Layout, OrderSummary } from './layout'

export function ObjednavkaPrijata({ order, pickupPlace, contact }: { order: Order; pickupPlace: string; contact: string }) {
  return (
    <Layout preview="Děkujeme, objednávku jsme přijali" contact={contact}>
      <Text>Dobrý den, {order.name},</Text>
      <Text>děkujeme za nákup. Platba proběhla a objednávku jsme přijali.</Text>
      <OrderSummary order={order} pickupPlace={pickupPlace} />
    </Layout>
  )
}
