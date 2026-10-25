import { Text } from '@react-email/components'
import type { Order } from '#/server/orders'
import { formatAddress, Layout } from './layout'

// Variant by způsob doručení: sent to the doručovací adresa, or ready at the odběrní místo.
export function ObjednavkaVyrizena({ order, pickupPlace, contact }: { order: Order; pickupPlace: string; contact: string }) {
  return (
    <Layout preview="Vaše objednávka je vyřízená" contact={contact}>
      <Text>Dobrý den, {order.name},</Text>
      {order.delivery === 'odber' ? (
        <Text>vaše objednávka je připravená k vyzvednutí na místě: {pickupPlace}.</Text>
      ) : (
        <Text>
          vaši objednávku jsme odeslali na adresu:{' '}
          {order.address && formatAddress(order.address)}.
        </Text>
      )}
    </Layout>
  )
}
