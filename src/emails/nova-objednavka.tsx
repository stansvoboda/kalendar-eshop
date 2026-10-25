import { Text } from '@react-email/components'
import type { Order } from '#/server/orders'
import { Layout, OrderSummary } from './layout'

// Upozornění pro obchodníka.
export function NovaObjednavka({ order, pickupPlace, contact }: { order: Order; pickupPlace: string; contact: string }) {
  return (
    <Layout preview={`Nová objednávka od ${order.name}`} contact={contact}>
      <Text>
        Nová zaplacená objednávka od {order.name} ({order.email}).
      </Text>
      <OrderSummary order={order} pickupPlace={pickupPlace} />
    </Layout>
  )
}
