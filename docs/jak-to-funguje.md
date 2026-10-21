# Jak to funguje

## Kde co běží

| Část | Co dělá | Kde běží |
|---|---|---|
| **Sanity** (headless CMS) | Data: produkty a objednávky. Editor (Studio) je ve složce `studio/`. | sanity.io |
| **E-shop** (TanStack Start) | Web plus serverová část | Cloudflare Workers |
| **Stripe** | Platební stránka a zpracování karty | stripe.com |

## Jak probíhá nákup

1. **Katalog.** Server Workeru stáhne produkty ze Sanity dotazem v GROQ (`src/server/shop.ts`) a vykreslí hotové HTML. Je to rychlé a vyhledávače stránku dobře přečtou. TanStack Query pak data drží v prohlížeči, takže přechod mezi stránkami nic znovu nestahuje.
2. **Košík.** Žije jen v prohlížeči (TanStack Store + `localStorage`) a ukládá jen dvojice *id produktu + počet*. Ceny tam záměrně nejsou.
3. **Pokladna.** Formulář (TanStack Form + Zod) zkontroluje jméno a e-mail. Pak zavolá serverovou funkci `createCheckout`, ta:
   - znovu zvaliduje vstup (klientovi se nevěří),
   - **znovu načte ceny ze Sanity**, takže cenu nejde podvrhnout z prohlížeče,
   - založí Stripe Checkout Session a vrátí její URL.
4. **Platba.** Zákazník zaplatí na stránce Stripe a vrátí se na `/dekujeme`.
5. **Objednávka.** Stripe pošle webhook na `/api/stripe-webhook`. Server:
   - ověří podpis, že zprávu opravdu poslal Stripe,
   - stáhne položky objednávky,
   - zapíše do Sanity dokument `orders.<session id>`. Tečka v ID ho drží v soukromí. Když Stripe pošle stejnou zprávu znovu, duplikát nevznikne.

**Tajné klíče** jsou lokálně v `.env` a na produkci v Cloudflare secrets. Do prohlížeče se nedostanou.

## Co chybí do skutečného obchodu

Seřazené od nejdůležitějšího.

### 1. Doprava a adresa: tohle je teď největší díra
- E-shop **nesbírá doručovací adresu**. Kalendáře jsou fyzické zboží, takže nevíš, kam je poslat. Ve Stripe Checkout to jde zapnout přes `shipping_address_collection`.
- Chybí výběr dopravy a její cena (Zásilkovna, PPL, Balíkovna). Ve Stripe na to jsou `shipping_options`. Výdejní místa Zásilkovny potřebují jejich widget už v košíku.

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
- **E-maily:** potvrzení zákazníkovi a upozornění tobě. Nejrychlejší je zapnout potvrzení e-mailem přímo ve Stripe, lepší je vlastní e-mail přes Resend.
- **Stav objednávky** (zaplaceno, odesláno, doručeno). Teď je objednávka ve Studiu jen pro čtení.
- **Sklad:** nikde se nehlídá počet kusů, takže můžeš prodat víc kalendářů, než máš.
- Stránka „Děkujeme“ neověřuje, že platba opravdu proběhla. Jen vyprázdní košík.

### 5. Spolehlivost a bezpečnost
- **Monitoring:** Sentry nebo Cloudflare logy s upozorněním, když webhook selže. Stripe ho sice opakuje až 3 dny, ale o selhání se nedozvíš.
- **Omezení počtu požadavků** na vytvoření pokladny, aby ji nikdo nezahlcoval.
- **E2E testy** (Playwright) na celý nákup s testovací kartou. Teď jsou otestované jen košík a validace.

### 6. Web a prodejnost
- Vlastní doména, kterou na Cloudflare připojíš pár kliknutími.
- Design. Teď je to holé shadcn.
- SEO: popisy, Open Graph obrázky pro sdílení, sitemap.
- Optimalizace obrázků (Sanity CDN umí `?w=` i `auto=format`) a analytika.

Pro portfolio je současný stav dobrý: ukazuje celý tok od CMS přes platbu po webhook. Pro skutečný prodej je minimum body **1, 2 a 3** a k tomu e-maily z bodu 4.
