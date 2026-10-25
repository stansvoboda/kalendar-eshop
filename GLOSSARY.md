# Kalendáře e-shop

Malý internetový obchod s tištěnými kalendáři. Kupující vybere produkty, zaplatí a obchod objednávku ručně vyřídí.

## Katalog

**Produkt**:
Kalendář nabízený k prodeji, s názvem, cenou v Kč, obrázkem a počtem kusů skladem.
_Avoid_: Zboží, položka, item

**Skladem**:
Počet kusů produktu, které lze ještě prodat. Ubývá vznikem objednávky, ne platebním pokusem.
_Avoid_: Zásoba, inventory

**Vyprodaný**:
Produkt s nulovým počtem kusů skladem; zůstává v katalogu, ale nejde koupit.
_Avoid_: Nedostupný, skrytý

## Nákup

**Košík**:
Seznam produktů a počtů kusů, který si kupující skládá před placením. Neobsahuje ceny; ty platí vždy aktuální z katalogu.
_Avoid_: Cart, nákupní seznam

**Kupující**:
Člověk, který nakupuje jako host bez účtu; existuje jen jako kontaktní údaje u objednávky.
_Avoid_: Zákazník, uživatel, účet

**Platební pokus**:
Přechod kupujícího na platební stránku. Vznikne jen tehdy, když je dost kusů skladem. Dokud není zaplacen, nejde o objednávku a nic neubírá ze skladu.
_Avoid_: Nezaplacená objednávka, čekající objednávka

**Objednávka**:
Zaplacený nákup. Vzniká teprve úspěšnou platbou, nikdy dřív.
_Avoid_: Nákup, transakce, order

**Stav objednávky**:
Kde se objednávka nachází při vyřizování: **Zaplacená**, **Vyřízená** (odeslaná, nebo připravená k osobnímu odběru) nebo **Stornovaná**. Vyřízenou nejde vrátit na Zaplacenou. Kupující dostane e-mail o každé změně stavu.
_Avoid_: Status, Odeslaná, Doručená

**Storno**:
Vrácení celé zaplacené částky; jedině tím se objednávka stane Stornovanou, i když už je vyřízená. Částečné vrácení peněz stav nemění. Storno nevrací kusy na sklad.
_Avoid_: Zrušení, refund

**Přeprodej**:
Objednávka, po které klesne počet kusů skladem pod nulu, protože více kupujících zaplatilo současně za poslední kusy. Obchod o něm dostane upozornění a rozhodne o stornu.
_Avoid_: Overselling, chybějící zboží

## Doručení

**Způsob doručení**:
Jak se objednávka dostane ke kupujícímu: **Doručení na adresu** za jednu pevnou cenu bez ohledu na počet kusů, nebo **Osobní odběr** zdarma na jediném odběrním místě. Kupující ho volí v košíku.
_Avoid_: Doprava, shipping

**Doručovací adresa**:
Adresa, kam se objednávka posílá; vyžaduje se jen u doručení na adresu.
_Avoid_: Fakturační adresa
