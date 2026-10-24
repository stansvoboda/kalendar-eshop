import type { ReactNode } from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { Order } from '#/server/orders'
import { deliveryLabel, formatCzk } from '#/lib/shop'

// Shared layout for every e-mail: shop name header, contact footer.
export function Layout({ preview, contact, children }: { preview: string; contact: string; children: ReactNode }) {
  return (
    <Html lang="cs">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'Helvetica, Arial, sans-serif', color: '#18181b' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '24px auto', padding: '24px', maxWidth: '560px' }}>
          <Heading as="h1" style={{ fontSize: '22px', margin: '0 0 16px' }}>
            Kalendáře
          </Heading>
          {children}
          <Hr />
          <Text style={{ fontSize: '12px', color: '#71717a' }}>Kalendáře · Kontakt: {contact}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const formatAddress = (address: NonNullable<Order['address']>) =>
  [address.name, address.line1, address.line2, `${address.postalCode} ${address.city}`].filter(Boolean).join(', ')

// Položky, způsob doručení and celkem, shared by e-mails that summarise an objednávka.
export function OrderSummary({ order, pickupPlace }: { order: Order; pickupPlace: string }) {
  return (
    <Section>
      {order.items.map((item) => (
        <Text key={item._key} style={{ margin: '4px 0' }}>
          {item.qty} × {item.name}: {formatCzk(item.subtotal)}
        </Text>
      ))}
      <Text style={{ margin: '4px 0' }}>
        {deliveryLabel(order.delivery)}
        {order.delivery === 'odber' && `: ${pickupPlace}`}:{' '}
        {formatCzk(order.deliveryPrice)}
      </Text>
      {order.address && (
        <Text style={{ margin: '4px 0' }}>
          Doručovací adresa: {formatAddress(order.address)}
        </Text>
      )}
      <Text style={{ fontWeight: 'bold' }}>Celkem: {formatCzk(order.total)}</Text>
    </Section>
  )
}
