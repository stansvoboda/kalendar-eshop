# Jak to funguje

## Kde co běží

| Část | Co dělá | Kde běží |
|---|---|---|
| **Sanity** (headless CMS) | Data: produkty a objednávky. Editor (Studio) je ve složce `studio/`. | sanity.io |
| **E-shop** (TanStack Start) | Web plus serverová část | Cloudflare Workers |
| **Stripe** | Platební stránka a zpracování karty | stripe.com |

## Jak probíhá nákup

1. **Katalog.** Server Workeru stáhne produkty ze Sanity dotazem v GROQ (`src/server/shop.ts`) a vykreslí hotové HTML. Do prohlížeče jde jen příznak Skladem / Vyprodáno, přesný počet kusů zůstává na serveru. Vyprodaný produkt je v katalogu vidět, ale nejde přidat do košíku. TanStack Query pak data drží v prohlížeči, takže přechod mezi stránkami nic znovu nestahuje.
2. **Košík.** Žije jen v prohlížeči (TanStack Store + `localStorage`) a ukládá jen dvojice *id produktu + počet* a zvolený způsob doručení (Doručení na adresu za pevnou cenu, nebo Osobní odběr zdarma). Ceny tam záměrně nejsou. Serverová funkce `getStockProblems` vrátí položky, kterých je v košíku víc, než je skladem (bez počtů); košík je označí a nepustí k platbě.
3. **Pokladna.** Formulář (TanStack Form + Zod) zkontroluje jméno a e-mail. Pak zavolá serverovou funkci `createCheckout`, ta:
   - znovu zvaliduje vstup (klientovi se nevěří),
   - **znovu načte ceny a sklad ze Sanity**, takže cenu nejde podvrhnout z prohlížeče, a odmítne košík, který se nevejde do skladu,
   - založí Stripe Checkout Session s cenou doručení (u Doručení na adresu nechá Stripe sebrat adresu) a vrátí její URL.
4. **Platba.** Kupující zaplatí na stránce Stripe a vrátí se na `/dekujeme`. Ta se Stripe zeptá, jestli je session opravdu zaplacená; teprve pak ukáže shrnutí a vyprázdní košík. Po nezaplaceném pokusu košík zůstane.
5. **Objednávka.** Stripe pošle webhook na `/api/stripe-webhook`. Server ověří podpis a předá událost do `src/server/order-events.ts`:
   - `checkout.session.completed` (zaplaceno): zapíše do Sanity dokument `orders.<session id>` (tečka v ID ho drží v soukromí), atomicky odečte kusy skladem, pošle kupujícímu „Objednávka přijata“, obchodu „Nová objednávka“ a při přeprodeji (sklad pod nulou) upozornění. Každý hotový krok si objednávka zapíše, takže opakovaná zpráva od Stripe nic nezdvojí a dokončí jen to, co minule selhalo.
   - `charge.refunded`: plné vrácení peněz udělá z objednávky Stornovanou a pošle e-mail o stornu; částečné pošle e-mail s vrácenou částkou. Kusy se do skladu nevrací.
6. **Vyřízení.** Obchodník ve Studiu přepne stav na Vyřízená. Sanity webhook na `/api/sanity-webhook` (ověřený podpisem) pak pošle kupujícímu „Objednávka vyřízena“: odeslaná na adresu, nebo připravená k osobnímu odběru.

**Tajné klíče** jsou lokálně v `.env` a na produkci v Cloudflare secrets. Do prohlížeče se nedostanou.

## Co chybí do skutečného obchodu

Seřazené od nejdůležitějšího.

### 1. Doprava
- Jen jedna pevná cena doručení a jedno odběrní místo. Přepravci (Zásilkovna, PPL, Balíkovna) chybí; výdejní místa Zásilkovny potřebují jejich widget už v košíku.

### 2. Právo a účetnictví (ČR)
- Obchodní podmínky, reklamační řád, poučení o odstoupení do 14 dnů a zásady zpracování osobních údajů (GDPR).
- Identifikace prodejce na webu: jméno nebo firma, IČO, adresa a kontakt.
- **Faktury nebo daňové doklady** ke každé objednávce. Řeší to napojení na Fakturoid nebo iDoklad, případně Stripe Invoicing.
- DPH: pokud jsi plátce, ceny s DPH a sazba na dokladu.
- Cookie lišta, jakmile přidáš analytiku.

### 3. Platby
- Aktivovat Stripe **live** režim (ověření identity a bankovní účet) a vyměnit `sk_test_` za `sk_live_` a webhook.
- Češi často chtějí platit převodem nebo QR platbou, případně Apple Pay nebo Google Pay (ty Stripe umí). Alternativou jsou GoPay nebo Comgate.
- Slevové kódy jsou ve Stripe jeden parametr (`allow_promotion_codes`).

### 4. Provoz objednávek
- Storno jde jen vrácením peněz ve Stripe a kusy se do skladu nevrací automaticky.
- Žádná rezervace kusů během platby: když poslední kusy zaplatí dva kupující naráz, vznikne přeprodej a obchod dostane upozornění.

### 5. Spolehlivost a bezpečnost
- **Monitoring:** Sentry nebo Cloudflare logy s upozorněním, když webhook selže. Stripe ho sice opakuje až 3 dny, ale o selhání se nedozvíš.
- **Omezení počtu požadavků** na vytvoření pokladny, aby ji nikdo nezahlcoval.
- **E2E test** (Playwright, `e2e/nakup.spec.ts`) projde nákup s testovací kartou; webhooky a e-maily ověřují jen unit testy.

### 6. Web a prodejnost
- Vlastní doména, kterou na Cloudflare připojíš pár kliknutími.
- Design. Teď je to holé shadcn.
- SEO: popisy, Open Graph obrázky pro sdílení, sitemap.
- Optimalizace obrázků (Sanity CDN umí `?w=` i `auto=format`) a analytika.

Pro portfolio je současný stav dobrý: ukazuje celý tok od CMS přes platbu po webhook. Pro skutečný prodej je minimum body **2 a 3**.
