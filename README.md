# Kalendáře e-shop

Minimal headless e-shop: **TanStack Start** (Router, Query, Form, Store) + **shadcn/ui** + **Zod**, products from **Sanity**, payments via **Stripe Checkout** (test mode), hosted on **Cloudflare Workers**.

## Setup

```bash
pnpm install && pnpm --dir studio install
./scripts/setup.sh   # interactive wizard: Sanity project, Stripe key, Cloudflare deploy, GitHub repo
```

## Dev

```bash
pnpm dev      # shop on http://localhost:3000
pnpm studio   # Sanity Studio on http://localhost:3333
pnpm test     # Vitest
pnpm run deploy
```

Orders: Stripe sends `checkout.session.completed` to `/api/stripe-webhook`, which saves an `order` document in Sanity (visible in Studio). To test it locally, run [Stripe CLI](https://docs.stripe.com/stripe-cli) and put the printed `whsec_…` into `.env` as `STRIPE_WEBHOOK_SECRET`:

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

Test card: `4242 4242 4242 4242`, any future date, any CVC.

## How it works

- `studio/` — Sanity Studio with the `product` schema (name, slug, price in CZK, image, description).
- `src/server/shop.ts` — server functions: product query (GROQ) and Stripe Checkout session. Prices are always re-read from Sanity on the server, never trusted from the client.
- `src/lib/shop.ts` — cart logic + Zod schemas (tested in `shop.test.ts`).
- `src/routes/api/stripe-webhook.ts` — verifies the Stripe signature and writes the order (`orders.<session id>`, private even in a public dataset; idempotent on Stripe retries).
- `src/lib/cart-store.ts` — cart in TanStack Store, persisted to `localStorage`.
