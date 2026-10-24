import { defineConfig, defineField, defineType } from 'sanity'
import { structureTool } from 'sanity/structure'

const product = defineType({
  name: 'product',
  title: 'Produkt',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Název', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'slug', title: 'URL', type: 'slug', options: { source: 'name' }, validation: (r) => r.required() }),
    defineField({ name: 'price', title: 'Cena (Kč)', type: 'number', validation: (r) => r.required().integer().positive() }),
    defineField({
      name: 'stock',
      title: 'Skladem (ks)',
      description: 'Záporné číslo znamená přeprodej.',
      type: 'number',
      initialValue: 0,
      validation: (r) => r.required().integer(),
    }),
    defineField({ name: 'image', title: 'Obrázek', type: 'image' }),
    defineField({ name: 'description', title: 'Popis', type: 'text' }),
  ],
  preview: { select: { title: 'name', media: 'image' } },
})

// Written by the Stripe webhook; read-only in Studio.
const order = defineType({
  name: 'order',
  title: 'Objednávka',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({ name: 'createdAt', title: 'Vytvořeno', type: 'datetime' }),
    defineField({ name: 'name', title: 'Jméno', type: 'string' }),
    defineField({ name: 'email', title: 'E-mail', type: 'string' }),
    defineField({ name: 'total', title: 'Celkem (Kč)', type: 'number' }),
    defineField({
      name: 'delivery',
      title: 'Způsob doručení',
      type: 'string',
      options: {
        list: [
          { title: 'Doručení na adresu', value: 'adresa' },
          { title: 'Osobní odběr', value: 'odber' },
        ],
      },
    }),
    defineField({ name: 'deliveryPrice', title: 'Cena doručení (Kč)', type: 'number' }),
    defineField({
      name: 'address',
      title: 'Doručovací adresa',
      type: 'object',
      hidden: ({ value }) => !value,
      fields: [
        defineField({ name: 'name', title: 'Jméno', type: 'string' }),
        defineField({ name: 'line1', title: 'Ulice', type: 'string' }),
        defineField({ name: 'line2', title: 'Doplněk adresy', type: 'string' }),
        defineField({ name: 'city', title: 'Město', type: 'string' }),
        defineField({ name: 'postalCode', title: 'PSČ', type: 'string' }),
        defineField({ name: 'country', title: 'Země', type: 'string' }),
      ],
    }),
    defineField({
      name: 'items',
      title: 'Položky',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({ name: 'productId', title: 'Id produktu', type: 'string' }),
            defineField({ name: 'name', title: 'Název', type: 'string' }),
            defineField({ name: 'qty', title: 'Počet', type: 'number' }),
            defineField({ name: 'subtotal', title: 'Mezisoučet (Kč)', type: 'number' }),
          ],
        },
      ],
    }),
    defineField({ name: 'stripeSessionId', title: 'Stripe session', type: 'string' }),
  ],
  orderings: [{ title: 'Nejnovější', name: 'createdAtDesc', by: [{ field: 'createdAt', direction: 'desc' }] }],
  preview: { select: { title: 'email', subtitle: 'createdAt' } },
})

export default defineConfig({
  name: 'default',
  title: 'Kalendáře',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
  dataset: 'production',
  plugins: [structureTool()],
  schema: { types: [product, order] },
})
