import { Text } from '@react-email/components'
import type { Order } from '#/server/orders'
import { Layout } from './layout'

// Upozornění pro obchodníka: the objednávka pushed these produkty below zero kusů skladem.
export function Preprodej({
  order,
  oversold,
  contact,
}: {
  order: Order
  oversold: { name: string; stock: number }[]
  contact: string
}) {
  return (
    <Layout preview={`Přeprodej v objednávce od ${order.name}`} contact={contact}>
      <Text>
        Objednávka od {order.name} ({order.email}) vznikla, ale některé produkty nejsou skladem. Rozhodni, zda ji
        vyřídit, nebo stornovat.
      </Text>
      {oversold.map((p) => (
        <Text key={p.name} style={{ margin: '4px 0' }}>
          {p.name}: skladem {p.stock} ks
        </Text>
      ))}
    </Layout>
  )
}
