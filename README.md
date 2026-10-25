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
set -a; . ./.env; set +a   # STRIPE_SECRET_KEY: stripe login may pick another account/sandbox
stripe listen --api-key "$STRIPE_SECRET_KEY" --events checkout.session.completed,checkout.session.async_payment_succeeded,charge.refunded --forward-to localhost:3000/api/stripe-webhook
```

Test card: `4242 4242 4242 4242`, any future date, any CVC.

### E2E test (Playwright)

One happy path in `e2e/`: add a produkt → Doručení na adresu → pay with 4242… on Stripe's hosted Checkout → „Děkujeme“ shows the paid summary and the košík is empty. It is not part of `pnpm test`. It needs a filled `.env` (`STRIPE_SECRET_KEY` in test mode, `SANITY_PROJECT_ID`/`SANITY_DATASET`/`SANITY_WRITE_TOKEN` with at least one product in stock, `STRIPE_WEBHOOK_SECRET` from `stripe listen`):

```bash
npx playwright install chromium                                 # once
stripe listen …                                                 # separate terminal, as above; keep `pnpm dev` running so the webhook finishes
pnpm test:e2e                                                   # starts `pnpm dev` on :3000 if not running
```

Způsob doručení: `DELIVERY_PRICE_CZK` (Doručení na adresu, default 99) and `PICKUP_PLACE` (odběrní místo text) are read on the server; see `.env.example`.

E-maily: after payment the kupující gets „Objednávka přijata“ and the obchodník „Nová objednávka“, sent via [Resend](https://resend.com). Set `RESEND_API_KEY`, `MERCHANT_EMAIL` and optionally `EMAIL_FROM` in `.env` (production: `wrangler secret put …`). Without a verified domain Resend only delivers to the account's own address. Templates are React Email components in `src/emails/`; new e-mails wrap their content in the shared `Layout`.

Stav objednávky: new orders are Zaplacená (missing stav = Zaplacená). In Studio the obchodník can only switch Zaplacená → Vyřízená; the kupující then gets „Objednávka vyřízena“ (sent to the address, or ready at the odběrní místo), at most once per objednávka. Set up a webhook in [sanity.io/manage](https://www.sanity.io/manage) → API → Webhooks:

- URL: `https://<your domain>/api/sanity-webhook`, method POST, trigger on **Update**, dataset `production`, drafts off
- Filter: `_type == "order" && stav == "vyrizena" && delta::changedAny(stav)`
- Projection: `{_id, stav}`
- Secret: any random string; put the same value into `SANITY_WEBHOOK_SECRET` (`.env`, production: `wrangler secret put SANITY_WEBHOOK_SECRET`). Requests with an invalid signature get 401.

## How it works

Podrobně česky, včetně toho, co chybí do skutečného obchodu: [docs/jak-to-funguje.md](docs/jak-to-funguje.md)

Nový e-shop podle tohohle (kopie, přejmenování, wizardy, spuštění naostro): [docs/novy-eshop.md](docs/novy-eshop.md)

- `studio/` — Sanity Studio with the `product` schema (name, slug, price in CZK, image, description).
- `src/server/shop.ts` — server functions: product query (GROQ) and Stripe Checkout session. Prices are always re-read from Sanity on the server, never trusted from the client.
- `src/lib/shop.ts` — cart logic + Zod schemas (tested in `shop.test.ts`).
- `src/routes/api/stripe-webhook.ts` — verifies the Stripe signature and writes the order (`orders.<session id>`, private even in a public dataset; idempotent on Stripe retries).
- `src/lib/cart-store.ts` — cart in TanStack Store, persisted to `localStorage`.
