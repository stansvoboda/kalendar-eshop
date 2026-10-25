# Jak založit nový e-shop podle tohohle

Nejrychlejší cesta je zkopírovat tenhle repozitář a projít dva wizardy. Ty založí a propojí všechny služby. Jak e-shop funguje uvnitř, popisuje [jak-to-funguje.md](jak-to-funguje.md).

## 0. Co budeš potřebovat

- **Účty:** [Sanity](https://www.sanity.io), [Stripe](https://stripe.com), [Cloudflare](https://dash.cloudflare.com), [Resend](https://resend.com) a GitHub. Všechny mají bezplatný tarif.
- **Nástroje:** Node 24, pnpm, [Stripe CLI](https://docs.stripe.com/stripe-cli) (`brew install stripe/stripe-cli/stripe`), `gh` a `jq`.

## 1. Kopie projektu

```bash
git clone https://github.com/stansvoboda/kalendar-eshop.git muj-eshop
cd muj-eshop && rm -rf .git && git init
pnpm install && pnpm --dir studio install
```

## 2. Přejmenování

Název „Kalendáře“ a `kalendar-eshop` jsou na těchto místech:

| Soubor | Co změnit |
|---|---|
| `wrangler.jsonc`, `package.json` | `name`; podle něj vznikne URL `https://<name>.<účet>.workers.dev` |
| `src/routes/__root.tsx` | titulek stránky a název v hlavičce |
| `src/emails/layout.tsx` | název obchodu v e-mailech |
| `src/server/order-events.ts` | výchozí odesílatel `EMAIL_FROM` |
| `studio/sanity.config.ts`, `studio/package.json` | název Studia |
| `scripts/setup.sh` | název GitHub repozitáře (`gh repo create …`) |
| `README.md`, `GLOSSARY.md`, `AGENTS.md` | texty a odkazy na repozitář |

Zbytek najdeš příkazem `grep -rn "Kalendáře\|kalendar-eshop" --exclude-dir=node_modules .`

## 3. Jiný druh produktu

Když produkt potřebuje jiná pole (velikost, barvu…), musí se změnit tři místa najednou, jinak se produkty v e-shopu tiše nezobrazí:

1. Schéma v Studiu: `product` v `studio/sanity.config.ts`
2. GROQ dotaz `PRODUCTS` v `src/server/shop.ts`
3. Zod schéma `productSchema` v `src/lib/shop.ts`

Doprava a odběrní místo se nastavují v `.env` (`DELIVERY_PRICE_CZK` a `PICKUP_PLACE`), kód se kvůli nim měnit nemusí.

## 4. Služby: dva wizardy

Spouštěj je v normálním terminálu, protože se ptají na hodnoty a otevírají prohlížeč. Hodnoty zapisují do `.env` a na Cloudflare.

```bash
./scripts/setup.sh              # 8 kroků
./scripts/setup-objednavky.sh   # 7 kroků
```

**`setup.sh`:** založí Sanity projekt, dataset a CORS, nasadí Studio, kde přidáš první produkty, a vytvoří token pro zápis objednávek. Pak vezme testovací klíč Stripe, nasadí e-shop na Cloudflare, zaregistruje Stripe webhook a založí GitHub repozitář.

**`setup-objednavky.sh`:** nastaví lokální webhook secret (Stripe CLI) a události `charge.refunded` a `checkout.session.async_payment_succeeded` na webhooku. Pak nastaví e-maily (Resend), odběrní místo, Sanity webhook „Objednávka vyřízena“, tajné hodnoty na Cloudflare a počty kusů skladem ve Studiu.

Když nějaký krok přeskočíš, wizard ho na konci vypíše jako „still to do by hand“.

## 5. Ověření

```bash
pnpm test                 # unit testy
pnpm dev                  # e-shop na http://localhost:3000
set -a; . ./.env; set +a
stripe listen --api-key "$STRIPE_SECRET_KEY" \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,charge.refunded \
  --forward-to localhost:3000/api/stripe-webhook
pnpm test:e2e             # celý nákup přes Stripe Checkout (jednou předtím: npx playwright install chromium)
```

Ručně: zaplať kartou `4242 4242 4242 4242` (libovolné datum a CVC) a zkontroluj, že ve Studiu přibyla objednávka a že přišly e-maily.

## 6. Spuštění naostro

Test mode a live mode jsou ve Stripe oddělené. Nic z testu se do živého režimu nepřenese.

- [ ] **Stripe:** aktivovat účet (Activate payments: údaje o firmě a bankovní účet).
- [ ] **Stripe:** live klíč `sk_live_…` nastavit přes `pnpm exec wrangler secret put STRIPE_SECRET_KEY`.
- [ ] **Stripe:** v live mode vytvořit webhook na `https://<doména>/api/stripe-webhook` s událostmi `checkout.session.completed`, `checkout.session.async_payment_succeeded` a `charge.refunded`. Jeho `whsec_…` nastavit přes `wrangler secret put STRIPE_WEBHOOK_SECRET`.
- [ ] **Resend:** ověřit vlastní doménu (bez ní chodí e-maily jen na adresu účtu) a pak nastavit `EMAIL_FROM` a `MERCHANT_EMAIL`.
- [ ] **Košík:** smazat text „Testovací režim: karta 4242…“ v `src/routes/kosik.tsx`.
- [ ] **Doména:** připojit vlastní doménu v Cloudflare → Workers → Settings → Domains a změnit URL obou webhooků (Stripe i Sanity).
- [ ] **Právo a účetnictví:** obchodní podmínky, GDPR, faktury a DPH, viz [Co chybí do skutečného obchodu](jak-to-funguje.md#co-chybí-do-skutečného-obchodu).

## Od nuly, bez kopie

Kostra projektu vznikla z TanStack CLI se šablonou Start a doplňky `shadcn`, `form`, `tanstack-query`, `store` a `cloudflare` (viz `.cta.json`). Přesný příkaz se mezi verzemi mění, aktuální je na [tanstack.com/start](https://tanstack.com/start). Všechno ostatní je vlastní kód. Nejdůležitější části:

| Část | Soubor |
|---|---|
| Produkty, kontrola skladu, vytvoření platby | `src/server/shop.ts` |
| Košík a validace | `src/lib/shop.ts`, `src/lib/cart-store.ts` |
| Webhooky | `src/routes/api/stripe-webhook.ts`, `src/routes/api/sanity-webhook.ts` |
| Objednávka: sklad, e-maily, storno | `src/server/order-events.ts` |
| E-mailové šablony | `src/emails/` |
| Schéma Studia | `studio/sanity.config.ts` |

Kopie repozitáře je i tak rychlejší: tyhle části jsou otestované a wizardy k nim sedí.
