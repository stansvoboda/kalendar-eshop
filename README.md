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

### E2E test (Playwright)

One happy path in `e2e/`: add a produkt → Doručení na adresu → pay with 4242… on Stripe's hosted Checkout → „Děkujeme“ shows the paid summary and the košík is empty. It is not part of `pnpm test`. It needs a filled `.env` (`STRIPE_SECRET_KEY` in test mode, `SANITY_PROJECT_ID`/`SANITY_DATASET`/`SANITY_WRITE_TOKEN` with at least one product in stock, `STRIPE_WEBHOOK_SECRET` from `stripe listen`):

```bash
npx playwright install chromium                                 # once
stripe listen --forward-to localhost:3000/api/stripe-webhook    # separate terminal
pnpm test:e2e                                                   # starts `pnpm dev` on :3000 if not running
```

Způsob doručení: `DELIVERY_PRICE_CZK` (Doručení na adresu, default 99) and `PICKUP_PLACE` (odběrní místo text) are read on the server; see `.env.example`.

E-maily: after payment the kupující gets „Objednávka přijata“ and the obchodník „Nová objednávka“, sent via [Resend](https://resend.com). Set `RESEND_API_KEY`, `MERCHANT_EMAIL` and optionally `EMAIL_FROM` in `.env` (production: `wrangler secret put …`). Without a verified domain Resend only delivers to the account's own address. Templates are React Email components in `src/emails/`; new e-mails wrap their content in the shared `Layout`.

## How it works

Podrobně česky, včetně toho, co chybí do skutečného obchodu: [docs/jak-to-funguje.md](docs/jak-to-funguje.md)

- `studio/` — Sanity Studio with the `product` schema (name, slug, price in CZK, image, description).
- `src/server/shop.ts` — server functions: product query (GROQ) and Stripe Checkout session. Prices are always re-read from Sanity on the server, never trusted from the client.
- `src/lib/shop.ts` — cart logic + Zod schemas (tested in `shop.test.ts`).
- `src/routes/api/stripe-webhook.ts` — verifies the Stripe signature and writes the order (`orders.<session id>`, private even in a public dataset; idempotent on Stripe retries).
- `src/lib/cart-store.ts` — cart in TanStack Store, persisted to `localStorage`.
