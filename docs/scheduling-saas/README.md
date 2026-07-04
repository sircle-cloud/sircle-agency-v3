# SIRCLE Scheduling SaaS — Onderzoek & Plan van Aanpak

> Product: een afsprakenplanner (Calendly-alternatief) met twee-weg sync naar
> Google Calendar en Microsoft/Outlook, te verkopen door **SIRCLE Solutions** —
> white-label, EU-gehost, AVG-first.
>
> Status: onderzoeksfase. Dit document is de basis voor de aparte bouw-sessie.
> Datum onderzoek: juli 2026. Alle prijzen/feiten zijn met bronnen onderbouwd
> (zie [§12 Bronnen](#12-bronnen)) maar verifieer tarieven vóór een offerte —
> scheduling-vendors wijzigen prijzen vaak.

---

## Inhoud

1. [Managementsamenvatting](#1-managementsamenvatting)
2. [Belangrijke correctie: Cal.com is niet meer wat het was](#2-belangrijke-correctie-calcom-is-niet-meer-wat-het-was)
3. [De drie routes: Build / Buy / Fork](#3-de-drie-routes-build--buy--fork)
4. [Waarom calendar-sync het hart én het risico is](#4-waarom-calendar-sync-het-hart-én-het-risico-is)
5. [Markt, prijzen en positionering](#5-markt-prijzen-en-positionering)
6. [Aanbevolen strategie voor SIRCLE](#6-aanbevolen-strategie-voor-sircle)
7. [Architectuur](#7-architectuur)
8. [Plan van aanpak (gefaseerd)](#8-plan-van-aanpak-gefaseerd)
9. [Kosten & marges](#9-kosten--marges)
10. [Risico's & mitigaties](#10-risicos--mitigaties)
11. [Beslissingen die nu genomen moeten worden](#11-beslissingen-die-nu-genomen-moeten-worden)
12. [Bronnen](#12-bronnen)

---

## 1. Managementsamenvatting

**Wat we bouwen:** een multi-tenant afsprakenplanner die SIRCLE onder eigen merk
(of het merk van de klant) verkoopt aan MKB-dienstverleners. Kernwaarde:
twee-weg agenda-sync (Google + Outlook), 100% EU-hosting, AVG-native, en een
prijs die níet per seat de pan uit rijst.

**De vier kernconclusies uit het onderzoek:**

1. **Het hele product staat of valt met de agenda-sync — en dat is precies het
   moeilijkste stuk.** Niet het boekingsscherm, niet de e-mails: de OAuth-tokens,
   webhook-vernieuwingen, tijdzones/DST, terugkerende afspraken (RRULE) en
   dubbel-boek-races. Dit is maanden werk om zelf robuust te krijgen en het
   onderhoud stopt nooit. Zie [§4](#4-waarom-calendar-sync-het-hart-én-het-risico-is).

2. **Mijn eerdere advies "Cal.com is MIT, gewoon forken en white-labelen" was
   achterhaald.** Cal.com is in april 2026 grotendeels **closed source** gegaan;
   de open-source rest (`cal.diy`) is nu wél MIT, maar de **multi-tenant / teams /
   organizations-laag die je voor een SaaS nodig hebt is eruit gehaald**. Forken
   is daardoor minder aantrekkelijk dan het leek. Zie [§2](#2-belangrijke-correctie-calcom-is-niet-meer-wat-het-was).

3. **De verstandige route is "Buy": bouw je eigen product bovenop een managed
   calendar-API (Nylas), niet vanaf nul en niet op een Cal.com-fork.** Je krijgt
   Google + Outlook + iCloud sync, webhooks en beschikbaarheid in één API, in
   weken i.p.v. maanden, met ~85–90% brutomarge onder Calendly-prijzen. Je houdt
   je eigen domeinlaag (klanten, beschikbaarheid, boekingen) in je **eigen
   EU-database** achter een dunne adapter, zodat je later kunt wisselen
   (Nylas → Cronofy → zelf) zonder herbouw. Zie [§6](#6-aanbevolen-strategie-voor-sircle).

4. **De markt-hoek is scherp: flat-rate + EU/AVG + betaalbare white-label.**
   Calendly's pijnpunten zijn precies dit: per-seat schaalt duur, echte
   white-label pas bij duur Enterprise, en het draait op US-cloud (Schrems /
   CLOUD Act). Voor NL/EU-dienstverleners (zorg, consultancy, coaching) is
   "onder úw merk, 100% in de EU, verwerkersovereenkomst inbegrepen" een
   verhaal dat Calendly structureel niet kan matchen. Zie [§5](#5-markt-prijzen-en-positionering).

**Aanbevolen eerste stap:** bouw in 4–6 weken een MVP voor één klant (Koen),
op Nylas, single-tenant, met Google + Outlook sync + booking-pagina + embed.
Lever dat, en bouw daarna multi-tenant + white-label + facturatie eromheen.

---

## 2. Belangrijke correctie: Cal.com is niet meer wat het was

In de vorige sessie noemde ik Cal.com "MIT, dus vrij te forken en te verkopen".
Dat verdient een correctie, want de situatie is in 2026 twee keer gekanteld:

**Historisch (2022 – begin 2026):** Cal.com stond onder **AGPLv3, niet MIT**.
AGPLv3 is de "SaaS-sluitende" GPL: pas je de code aan en bied je die als
netwerkdienst aan, dan **moet je je wijzigingen als broncode aan je gebruikers
aanbieden**. Bovendien zat het **verwijderen van Cal.com-branding achter een
betaalde commerciële `/ee`-licentie**. White-label = feitelijk betaalde licentie
nodig. (Bron: cal.com/blog/changing-to-agplv3-and-introducing-enterprise-edition)

**Sinds 14 april 2026:** Cal.com heeft zijn commerciële productie-codebase
**closed source** gemaakt (privé-repo). De open-source variant is afgesplitst
naar **`cal.diy`** en van AGPLv3 **naar MIT** omgezet.
(Bronnen: cal.com/blog/cal-com-goes-closed-source-why ·
cal.com/blog/cal-diy-open-source-to-closed-source)

**Wat dat concreet betekent voor ons:**

| | Oud (AGPLv3) | Nu (`cal.diy`, MIT) |
|---|---|---|
| White-label toegestaan? | Alleen met betaalde `/ee`-licentie | Ja (MIT — copyrightnotice behouden, merknaam "Cal" niet voeren) |
| Netwerk-copyleft (broncode vrijgeven)? | Ja, bij wijzigingen | Nee |
| Multi-tenant / teams / organizations | Achter enterprise-licentie | **Verwijderd uit `cal.diy`** |
| Workflows / routing / SSO / analytics | In `/ee` | **Verwijderd uit `cal.diy`** |
| Volledige commerciële app | Publiek (AGPL + `/ee`) | **Closed source (privé-repo)** |

**Netto:** het *juridische* obstakel voor white-label is kleiner geworden (MIT is
vriendelijk), maar het *product-technische* obstakel is groter geworden. `cal.diy`
is nu een afgeslankte **single-tenant** editie, gericht op hobbyisten/experiment.
Precies de multi-tenant-laag die een SaaS ("één instance, veel klanten") nodig
heeft, is eruit gesloopt. Wil je die wél, dan zit die in de closed-source
enterprise-editie (sales-deal, geen publieke prijs) of het **Cal.com Platform**
(per-booking pricing, zie [§3](#3-de-drie-routes-build--buy--fork)).

**Extra waarschuwing:** Cal.com heeft in één beweging licentie én openheid
drastisch veranderd. Dat is een **governance-/stabiliteitsrisico**. Bouw je erop,
reken dan op verdere koerswijzigingen. Dit weegt mee in de conclusie dat we
Cal.com níet als fundament nemen.

---

## 3. De drie routes: Build / Buy / Fork

Er zijn drie manieren om aan de agenda-sync-motor te komen. Dit is de kernkeuze.

### Route A — Build direct (zelf op Google Calendar API + Microsoft Graph)
- **Voordeel:** volledige controle, geen per-account-fee, geen lock-in, maximale
  marge op schaal.
- **Nadeel:** je bouwt en onderhoudt zelf OAuth per provider, sync-state,
  webhook-vernieuwing, tijdzone-vertaling, RRULE-afhandeling en alle
  edge-cases. Vendor-schattingen (met een korrel zout, ze verkopen het
  alternatief): **2–4 maanden** voor basis, **6–9 maanden** voor "robuust", en
  de bouw is maar ~10% van de totale kosten — de rest is eeuwig onderhoud.
- **Verdict:** te traag en te broos voor een klein team dat snel wil leveren.
  Pas zinvol als sync jullie kern-differentiator wordt én je een dev structureel
  kunt vrijmaken. Fase 3+, niet de start.

### Route B — Buy (managed calendar-API: Nylas / Cronofy)
- **Voordeel:** Google + Microsoft + iCloud in één API, met OAuth-abstractie,
  webhooks, free/busy en (bij Nylas) een kant-en-klare Scheduler-component.
  Time-to-market: **weken i.p.v. maanden**. Zij dragen de renewal-hel en de
  provider-quirks.
- **Nadeel:** per-account-fee en vendor lock-in. Te mitigeren door je eigen
  domeinlaag in eigen DB te houden achter een dunne adapter.
- **Verdict:** ✅ **de aanbevolen route voor fase 1–2.** Zie [§6](#6-aanbevolen-strategie-voor-sircle).

### Route C — Fork (Cal.com `cal.diy` self-hosten)
- **Voordeel:** volledige productlaag (booking pages, availability, sync) in één
  MIT-codebase; nul per-account-fee.
- **Nadeel:** `cal.diy` is **single-tenant** (multi-tenant eruit gesloopt),
  8 GB+ RAM, breekbare upgrades, kritische `CALENDSO_ENCRYPTION_KEY` (verander
  je die na de eerste run, dan zijn álle agenda-koppelingen stil onherstelbaar
  kapot), en een net-verschoven governance-situatie. Multi-tenant SaaS erbovenop
  bouwen = alsnog fors werk.
- **Verdict:** alleen als plan B / snelle interim voor één klant. Niet als
  fundament voor het SaaS-product.

### Cal.com Platform (een variant van "Buy")
Het API/Atoms-product van Cal.com (React-componenten + managed users + webhooks,
volledig white-label). Prijs **per booking**: gratis tot 25 bookings/mnd, daarna
$0,99; Essentials ~$299/mnd; Scale ~$2.499/mnd. Interessant maar duurder en meer
lock-in dan Nylas voor onze schaal; bovendien koop je dan Cal.com's productvisie
in plaats van je eigen IP te bouwen. Meenemen als vergelijking, niet als
eerste keus.

---

## 4. Waarom calendar-sync het hart én het risico is

Dit is het deel waar teams zich op verkijken. "Afspraken inplannen met sync"
klinkt simpel; het boekingsscherm is inderdaad een weekje werk. Maar de
**betrouwbare twee-weg sync** is een berg technische edge-cases. Dit is waarom
we het níet zelf vanaf nul bouwen.

### Google Calendar API
- **OAuth-scopes:** `calendar.readonly`, `calendar.events` (lezen/schrijven van
  events — meestal genoeg voor een booking-tool), `calendar.freebusy` (alleen
  free/busy, minst privacygevoelig).
- **Verificatie — belangrijke nuance (goed nieuws):** calendar-scopes zijn bij
  Google **"sensitive", níet "restricted"**. De dure, **jaarlijkse CASA
  security-assessment** (Tier 2, honderden–duizenden USD) geldt voor
  *restricted* scopes (Gmail, Drive) en is voor een **agenda-only app
  waarschijnlijk niet nodig** — een groot voordeel t.o.v. e-mailintegraties.
  Wél nodig: gewone **OAuth app-verificatie** (brand/logo, privacybeleid,
  homepage-eigendom, scope-rechtvaardiging, evt. demovideo) om van "Testing"
  naar "Production" te gaan. Doorlooptijd **dagen tot enkele weken**.
  > ⚠️ Verifieer de actuele scope-classificatie via Google's eigen docs vóór je
  > hierop plant — Google verschuift dit soms. (De twee onderzoekslijnen spraken
  > elkaar hier tegen; de officiële "restricted scopes"-lijst bevat calendar
  > níet, dus "sensitive" is de juiste lezing.)
- **Refresh-token verval:** zolang je OAuth-app in **"Testing"-status** staat,
  **verlopen refresh-tokens na 7 dagen** — koppelingen vallen dan stil om. Je
  moet dus naar "Production" (verificatie) vóór echte klanten. Refresh-tokens
  verlopen daarnaast na **6 maanden inactiviteit**, en er geldt een limiet van
  **100 refresh-tokens per Google-account per OAuth-client** (oudste wordt stil
  ingetrokken).
- **Watch/push-channels:** verlopen na **~1 week, zonder auto-renewal** — je moet
  ze proactief vernieuwen of updates stoppen stil. Notificaties bevatten
  **geen event-data** ("er is iets gewijzigd"), dus elke push triggert alsnog een
  sync-fetch.
- **Sync-tokens:** `nextSyncToken` komt **alleen op de laatste pagina** — mis je
  paginatie, dan krijg je nooit een token. Tokens verlopen → server geeft
  **`410 Gone`** → je moet lokaal wissen en een **volledige resync** doen.
- **Push is niet gegarandeerd** → productie draait webhooks **plus** een
  polling-fallback om gemiste notificaties op te vangen.

### Microsoft Graph (Outlook / Microsoft 365)
- **Azure AD app-registratie**, scopes `Calendars.Read` / `Calendars.ReadWrite`,
  delegated vs application permissions.
- **Change-notification subscriptions:** verlopen snel — **~4230 minuten (~3 dagen)
  voor agenda** — met een renewal-job of updates stoppen stil. Aanmaken vereist
  een **synchrone validation-handshake** (echo de `validationToken` binnen
  seconden, anders faalt de subscription).
- **On-premises/hybride Exchange wordt niet ondersteund door Graph** — die
  integratie **faalt stil**. Room/resource-mailboxes ondersteunen **geen
  Graph-webhooks** (alleen polling).
- **`getSchedule` / `findMeetingTimes`** voor beschikbaarheid.
- Persoonlijke Microsoft-accounts (outlook.com) vs werk/school (M365) gedragen
  zich verschillend — extra vertakkingslogica.

### CalDAV / iCloud (Apple, Fastmail)
Aparte, pijnlijkere code-path (Exchange gebruikte historisch zelfs
ActiveSync/WBXML). **Niet voor v1.** Managed API's (Nylas/Cronofy) dekken dit
desgewenst mee.

### De vier stille sluipmoordenaars
1. **Tijdzones & DST:** Google gebruikt **IANA** (`Europe/Amsterdam`), Microsoft
   gebruikt **Windows-namen** (`W. Europe Standard Time`) — je hebt een
   vertaalmatrix nodig, en die IANA-database wijzigt regelmatig. Sla altijd
   **lokale tijd + IANA-id** op en bereken de offset at runtime, anders "drijft"
   een wekelijkse afspraak van 9:00 rond de zomertijd-omschakeling.
2. **Terugkerende afspraken (RRULE, RFC 5545):** Google geeft RRULE-strings,
   Microsoft een genest JSON-object; sommige patronen die Google kent, kent
   Microsoft niet. Een geannuleerde losse instantie verschijnt bij Google als
   een **apart `status:cancelled`-object** (níet als EXDATE). "Deze en
   toekomstige afspraken bewerken" = de reeks atomisch splitsen/inkorten/
   opnieuw aanmaken. Dit "kost routinematig weken engineering".
3. **Dubbel-boeken / race-conditions:** twee mensen die tegelijk hetzelfde slot
   pakken. Los op met DB-transacties + een unieke constraint op (tenant, host,
   tijdslot) en idempotency-keys. Polling-fallback op 5–15 min opent
   dubbel-boek-vensters → daarom webhooks als primaire trigger.
4. **Sync-loops:** twee-weg sync creëert echo's. Zet een **verborgen
   metadata-tag** op elk event dat je zelf aanmaakt (bv.
   `sircleSyncId: <tenant>:<booking>`) zodat je je eigen kopieën overslaat.
   Matchen op titel/tijd breekt zodra iemand een titel wijzigt.

### Top-5 die teams onderschatten
1. Webhook-**renewal-jobs** (Google ~wekelijks, Graph ~3-daags) — mis je het
   venster, dan sterft de sync stil.
2. **`410 Gone`** sync-token-invalidatie → volledige wipe + resync.
3. **IANA↔Windows** tijdzone-matrix onderhouden + **DST-drift** op reeksen.
4. **OAuth app-verificatie** (dagen–weken doorlooptijd om van "Testing" naar
   "Production" te gaan) blokt je launch als je het te laat inplant — plus de
   7-daagse testing-token-val. (De zwaardere jaarlijkse CASA-assessment is voor
   agenda-only waarschijnlijk níet nodig; zie de nuance hierboven.)
5. **Provider-quirks** die stil breken: hybride Exchange, room-mailboxes,
   all-day off-by-one, 7-daagse testing-token.

**Conclusie van dit hoofdstuk:** al deze punten zijn precies wat een managed API
(Nylas/Cronofy) voor je wegneemt. Dit is het sterkste argument voor "Buy".

---

## 5. Markt, prijzen en positionering

### Prijzen van de belangrijkste spelers (2025/2026, indicatief, USD tenzij vermeld)

| Product | Plan | Prijs/mnd | Model | White-label? |
|---|---|---|---|---|
| **Calendly** | Standard / Teams | $10 / $16 per seat | per seat | Nee (URL blijft calendly.com) |
| | Enterprise | vanaf ~$15.000/jaar | per org | Beperkt (custom branding) |
| **Cal.com** | Teams / Organizations | $12 / $28 per user | per user | Ja (paid tiers) |
| | Platform (API) | $0,50–0,99 per booking | per booking | Ja (embed/API) |
| **Acuity** | Starter → Premium | $16 → $49 | per account | Beperkt |
| **Microsoft Bookings** | in M365 Business | vanaf $6/user | zit in M365 | Nee (binnen tenant) |
| **YouCanBook.me** | Individual → Teams | $9 → $18 | per user | Ja |
| **TidyCal** | Lifetime | $29 eenmalig | lifetime | Beperkt |
| **EU: meetergo / Zeeg** | — | vanaf €7 | per user | Ja (DE/EU-hosted) |
| **NL niche: Salonized** | — | vanaf €29 per salon | per vestiging | N.v.t. (verticaal) |

### Calendly's zwakke plekken = ons aanvalsvlak
- **Per-seat schaalt duur** — 30 mensen op Teams ≈ $480–600/mnd. Teams worden
  "bestraft" voor groei.
- **Kernfeatures gated:** round-robin, routing en SSO pas op Teams/Enterprise.
- **Geen betaalbare white-label:** de booking-URL blijft `calendly.com`; echte
  white-label pas bij Enterprise (low-five-figures/jaar). **Dit is het gat.**
- **US-cloud:** onder **Schrems II** en de **US CLOUD Act** een reëel
  AVG-bezwaar voor zorg, overheid, juridisch en finance.

### Waar zit de betalingsbereidheid (NL/MKB)
- **Hoog:** consultancy / coaching / advies (een no-show kost meer dan een
  jaarabonnement; koppeling met betaling verhoogt waarde) en **zorg/paramedisch**
  (herhaalafspraken, no-show-reductie, en **AVG = harde eis**).
- **Verzadigd, niet frontaal aanvallen:** kappers/beauty (Salonized, Treatwell).
- **Bezet door Calendly:** B2B sales-demo's / round-robin.

### Positionering voor SIRCLE — drie hefbomen
1. **AVG-first, 100% EU-dataresidentie + verwerkersovereenkomst standaard.**
   Geen US-cloud. Beslissend voor zorg/overheid/juridisch; Calendly kan dit
   alleen via duur Enterprise.
2. **Flat-rate i.p.v. per-seat.** Directe pijnstiller tegen oplopende
   seat-kosten en gated features.
3. **Betaalbare, echte white-label onder het merk van de klant.** Eigen
   domein/branding zonder Calendly-URL en zonder five-figure contract.

### Voorgestelde prijszetting (EUR, te valideren)
- **Solo / ZZP:** €12–19/mnd flat (1 gebruiker, EU-hosted, eigen branding-lite).
- **Praktijk / klein team:** €39–59/mnd flat per organisatie (tot ~5 users, geen
  per-seat straf, DPA inbegrepen). **Kern-propositie.**
- **White-label per klant (agency-aanbod):** €79–149/mnd per merk/tenant, óf
  setup-fee (€250–750 eenmalig) + €25–50/mnd hosting & onderhoud per klant.
  **Hier zit de recurring agency-marge.**

> Het product is grotendeels een commodity; de marge voor SIRCLE zit in
> **service, integratie, hosting en onderhoud onder het merk van de klant** —
> niet in de per-seat licentie zelf. Dat past bij het agency-/CircleCare-model.

---

## 6. Aanbevolen strategie voor SIRCLE

**Bouw je eigen white-label product bovenop Nylas, met je eigen domeinlaag in een
eigen EU-database.** Concreet:

1. **Calendar-sync = Nylas (managed API), fase 1.**
   - Dekt Google + Microsoft/Outlook + Exchange + iCloud in één API, met
     kant-en-klare Scheduler-component.
   - Prijs: **$10/mnd + $1,50 per gekoppeld account** (na eerste 5). Bij verkoop
     €10–15 blijft ~85–90% brutomarge. Lage instap = geen kapitaalrisico bij
     lage volumes.
   - **Zet direct de EU-regio (Ierland) aan** (`ireland.api.nylas.com`) en teken
     de DPA — dat dekt de NL-klant.

2. **Je eigen domeinlaag blijft van jou.** Klanten (tenants), gebruikers,
   beschikbaarheidsregels, event-types en boekingen staan in je **eigen
   EU-Postgres**. Nylas gebruik je puur als **sync/OAuth-adapter achter een dunne
   interface** (`CalendarProvider`). Dan is een latere migratie
   **Nylas → Cronofy → zelf** een adapter-swap, geen herbouw. Dit is de
   belangrijkste anti-lock-in-maatregel.

3. **Opschaalpad:** zodra je richting honderden betalende accounts gaat,
   herbereken **Cronofy** (hoge vaste bodem ~$819/mnd, maar $0,35/account en
   sterkere EU-compliance: ISO 27001/27701/27018, SOC 2, Duitse regio — beter
   verkoopbaar aan enterprise/zorg). Dankzij de adapter is dat een kwestie van
   een nieuwe implementatie achter dezelfde interface.

4. **Cal.com** houden we als **referentie/UX-inspiratie** en eventueel als
   snelle interim voor één klant (`cal.diy` self-hosted), maar **niet als
   fundament**.

**Waarom niet forken of zelf bouwen?**
- Zelf bouwen: 6–9 maanden tot "robuust" + eeuwig onderhoud (§4). Te traag.
- Cal.com forken: `cal.diy` mist multi-tenant (§2), governance-risico, zware
  self-host. Je bouwt de tenant-laag alsnog zelf én erft iemand anders'
  productbeslissingen.
- Nylas: weken tot MVP, marge gezond, lock-in beheersbaar via eigen domeinlaag.

---

## 7. Architectuur

Voorstel, in lijn met wat we al doen (moderne JS-stack) maar bewust apart van de
statische agency-site (dit is een echt SaaS-product, geen pagina).

### Stack
- **Frontend + backend:** **Next.js (App Router) + TypeScript** — één codebase
  voor booking-pagina's, het admin-dashboard en de API-routes/serveracties.
- **Database:** **PostgreSQL in de EU** (bv. Supabase EU-regio, of self-hosted
  Postgres bij een EU-provider — Hetzner/Scaleway). Row-Level Security voor
  tenant-isolatie.
- **ORM:** Prisma (of Drizzle).
- **Calendar-sync:** **Nylas** achter een eigen `CalendarProvider`-interface.
- **Auth:** Auth.js (NextAuth) of Clerk — voor de *beheerders* (de dienstverleners).
  Boekende eindklanten hebben géén account nodig.
- **Betalingen (facturatie van tenants):** Stripe Billing.
- **Betalingen bij boeking (optioneel, fase 4):** Stripe Checkout / Mollie
  (Mollie is sterker in NL/EU: iDEAL, SEPA).
- **E-mail:** Resend / Postmark (bevestigingen + reminders), EU-regio waar mogelijk.
- **Embed:** een lichte `<iframe>`-widget + een `<script>`-snippet, zodat klanten
  de planner op hun eigen site zetten (net als Calendly's embed).
- **Hosting:** Vercel (let op: dataresidentie — DB en verwerking in EU houden;
  functions-region EU), of volledig EU (Hetzner + Coolify/Docker) als AVG-purisme
  een verkoopargument moet zijn.

### Multi-tenant vanaf dag één
Elke tabel krijgt een `tenant_id`; RLS forceert isolatie. Eén instance bedient
alle klanten. Custom branding (logo, kleuren, subdomein/eigen domein) per tenant.

### Datamodel (schets)
```
tenants          (id, naam, slug, branding_json, plan, stripe_customer_id, tijdzone)
users            (id, tenant_id, email, rol)                      -- beheerders
calendar_connections (id, tenant_id, user_id, provider, nylas_grant_id,
                      status, laatste_sync)                        -- tokens bij Nylas
event_types      (id, tenant_id, naam, duur_min, buffer_voor/na, locatie_type)
availability_rules (id, tenant_id, user_id, weekdag, start, eind, tijdzone_iana)
blocked_dates    (id, tenant_id, user_id, datum_van, datum_tot)
bookings         (id, tenant_id, event_type_id, host_user_id,
                  gast_naam, gast_email, start_utc, eind_utc, tijdzone_iana,
                  status, external_event_id, idempotency_key)
webhooks_log     (id, tenant_id, provider, payload, verwerkt_op)
```

### Tijdzone- en dubbel-boek-regels (hard afdwingen)
- Sla tijden op als **UTC-instant + originele IANA-tijdzonenaam**
  (`Europe/Amsterdam`) — nooit een vaste offset, nooit alleen UTC voor
  toekomstige/terugkerende reeksen (anders "drijft" een wekelijkse 9:00-afspraak
  rond de DST-omschakeling). Houd de tzdata (IANA) up-to-date.
- **Dubbel-boeken atomair op DB-niveau blokkeren** met een PostgreSQL
  **exclusion constraint** (`btree_gist`) over een `tstzrange` per
  `(tenant_id, host_user_id)` — de robuustste garantie: de database weigert
  overlappende slots. Alternatief/aanvullend: `SELECT ... FOR UPDATE` binnen een
  transactie.
- **Idempotency-key** op de boekingsrequest tegen dubbelklikken/retries.
- Webhooks als primaire sync-trigger; polling-fallback (elke ~10 min) als
  vangnet, met verkorte free/busy-check vlak vóór definitief bevestigen.

### Security
- OAuth-tokens: bij Nylas belegd (minder eigen risico). Houd je eigen secrets
  (Nylas API-key, Stripe, DB) in een secrets-manager, niet in de repo.
- Verborgen sync-metadata-tag op elk aangemaakt event (anti-echo, §4).
- AVG: dataminimalisatie (alleen naam/e-mail/tijd van de gast), bewaartermijnen,
  verwerkersovereenkomst-template klaar, verwerkingsregister.

---

## 8. Plan van aanpak (gefaseerd)

> Tijdlijnen gaan uit van ~1–2 devs parttime. Ze zijn richtinggevend, niet
> contractueel. De **OAuth app-verificatie (§4) parallel vroeg starten** — die
> doorlooptijd (dagen–weken) mag niet op het kritieke pad van de launch komen.

### Fase 0 — Fundament & beslissingen (week 1–2)
- Beslissingen uit [§11](#11-beslissingen-die-nu-genomen-moeten-worden) nemen
  (build/buy definitief, hosting, merk, prijs).
- Nylas-account (EU/Ierland), Google Cloud-project + OAuth-consent-screen
  (OAuth app-verificatie **nu** in gang zetten), Azure AD app-registratie.
- Repo + skeleton: Next.js + Postgres (EU) + Prisma + auth.
- 30-min-validatiegesprek met Koen + de 2 andere wachtende klanten: welke exacte
  flow hebben ze nodig (1-op-1 intake? meerdere diensten? betaling vooraf?).

### Fase 1 — MVP voor één klant (week 3–8)
Doel: Koen kan echte afspraken ontvangen, met sync.
- Google + Outlook koppelen via Nylas (OAuth-flow).
- Beschikbaarheid instellen (werktijden, buffers, geblokkeerde dagen).
- Eén event-type + publieke **booking-pagina** (mobiel-first, in de SIRCLE-/klant-stijl).
- Free/busy uitlezen → alleen vrije slots tonen; boeking pusht naar de agenda
  van de host.
- Bevestigingsmail (host + gast) + .ics-bijlage.
- **Embed-widget** (iframe) voor op de site van de klant.
- Tijdzone- en dubbel-boek-afhandeling correct (§7).
- **Opleveren aan Koen.** Feedback ophalen.

### Fase 2 — Multi-tenant + white-label + facturatie (week 9–14)
- Tenant-isolatie (RLS), tenant-onboarding, per-tenant branding (logo, kleuren,
  subdomein → later eigen domein).
- Admin-dashboard: afspraken, event-types, beschikbaarheid, teamleden.
- Herinneringsmails (24u/1u vooraf) → no-show-reductie als verkoopargument.
- **Stripe Billing:** plannen (Solo / Praktijk / White-label), self-service
  abonnement.
- Annuleren/verzetten door de gast (met sync terug naar de agenda).
- Rol de andere twee wachtende klanten uit als tweede/derde tenant.

### Fase 3 — Hardening & AVG-proof (week 15–18)
- OAuth app-verificatie afronden (indien nog niet klaar) → uit "Testing"-status.
- Monitoring & alerting op sync-health (webhook-renewals, 410-resyncs,
  token-revocaties). Dead man's switch op verlopende channels.
- AVG-pakket: verwerkersovereenkomst, privacyverklaring, dataretentie,
  verwerkingsregister, "100% EU"-bewijs voor de sales-pitch.
- Load-/edge-case-tests: DST-omschakeling, terugkerende afspraken, gelijktijdige
  boekingen.

### Fase 4 — Groei & premium features (daarna, vraaggestuurd)
- Round-robin / team-scheduling (Calendly's gated feature — gratis bij ons).
- Betaling bij boeking (Mollie/Stripe) — hoge waarde voor consultants/coaches.
- Routing forms, meerdere talen (NL/EN), integraties (Zoom/Teams/Meet-links).
- **Migratie-heroverweging naar Cronofy** bij honderden accounts (§6).
- Reseller-portaal voor SIRCLE om tenants te beheren (past in CircleCare).

---

## 9. Kosten & marges

**Variabele COGS per betalende klant (Nylas, fase 1–2):**
- ~$1,50 per gekoppeld agenda-account/mnd (na eerste 5 gratis). Eén gebruiker
  koppelt meestal 1–2 agenda's.
- Bij verkoopprijs €12–15 (solo) tot €39–59 (praktijk): **~85–90% brutomarge**.

**Vaste kosten (indicatief):**
- Nylas basis: $10/mnd (schaalt mee).
- Hosting (Vercel + EU-Postgres/Supabase): ~€20–50/mnd bij lage volumes.
- E-mail (Resend/Postmark): ~€0–20/mnd bij lage volumes.
- OAuth app-verificatie: doorgaans **kosteloos** (dagen–weken doorlooptijd). De
  dure jaarlijkse CASA-assessment is voor agenda-only waarschijnlijk niet nodig
  (§4) — reserveer alleen budget als je later restricted scopes toevoegt.
- Domein/SSL per white-label klant: verwaarloosbaar.

**Break-even:** met de lage Nylas-bodem al bij een handvol betalende klanten.
De drie wachtende klanten dekken de vaste kosten ruim.

**Cronofy pas later:** de $819/mnd bodem is dodelijk bij lage volumes;
break-even rond ~50–80 betalende users. Niet in fase 1.

---

## 10. Risico's & mitigaties

| Risico | Impact | Mitigatie |
|---|---|---|
| Sync-onderhoud onderschat | Hoog | Managed API (Nylas) neemt renewal/quirks weg; eigen adapterlaag |
| Vendor lock-in (Nylas) | Middel | Eigen domeinlaag in eigen EU-DB; `CalendarProvider`-interface; Cronofy als exit |
| OAuth app-verificatie vertraagt launch | Middel | **Nu** starten, parallel aan de bouw; tot die tijd beperkte testgroep (let op 7-daagse testing-token) |
| `CALENDSO_ENCRYPTION_KEY`-val (bij Cal.com-interim) | Hoog | Cal.com niet als fundament; key-management gedocumenteerd als we `cal.diy` interim inzetten |
| Dubbel-boeken | Hoog | DB-constraint + transactie + idempotency + free/busy-check vlak vóór bevestiging |
| Tijdzone/DST-bugs | Middel | UTC + IANA opslaan; testsuite rond DST-omschakeling |
| AVG-non-compliance | Hoog (verkoop) | EU-hosting, DPA, dataminimalisatie, verwerkingsregister vanaf fase 1 |
| Cal.com-achtige governance-verrassingen | Middel | Bouw eigen IP; managed API is vervangbaar; geen enkele leverancier als single point of failure |
| Concurrentie (MS Bookings "gratis" in M365) | Middel | Differentieer op white-label + UX + AVG-service, niet op prijs alleen |

---

## 11. Beslissingen die nu genomen moeten worden

Voordat de bouw-sessie start, deze knopen doorhakken:

1. **Route bevestigen:** akkoord met **Buy (Nylas) + eigen domeinlaag**, i.p.v.
   zelf bouwen of Cal.com forken? (Aanbeveling: ja.)
2. **Merkstrategie:** verkopen we onder één SIRCLE-merk ("SIRCLE Planner") of
   volledig white-label onder het merk van elke klant, of beide (SIRCLE-merk voor
   kleine klanten, white-label als premium)?
3. **Hosting-purisme:** is "100% EU, geen US-cloud" een harde verkoop-eis? Zo ja,
   dan Hetzner/Scaleway + EU-Postgres i.p.v. Vercel-US-functions. Zo nee, dan
   Vercel (EU-region) + Supabase EU voor snelheid.
4. **Prijsmodel bevestigen** (§5): flat-rate tiers + white-label-fee.
5. **Eerste klant-scope:** wat heeft Koen exact nodig voor de MVP (aantal
   diensten, betaling vooraf ja/nee, teamleden ja/nee)?
6. **Betaling bij boeking in scope voor v1 of fase 4?** (Aanbeveling: fase 4.)

---

## 12. Bronnen

**Cal.com licentie & self-hosting**
- https://cal.com/blog/cal-com-goes-closed-source-why
- https://cal.com/blog/cal-diy-open-source-to-closed-source
- https://cal.com/blog/changing-to-agplv3-and-introducing-enterprise-edition
- https://github.com/calcom/cal.diy
- https://cal.com/platform/pricing · https://cal.com/atoms · https://cal.com/enterprise
- https://thenewstack.io/cal-com-codebase-security-ai/

**Calendar-sync techniek (Google / Microsoft)**
- https://developers.google.com/workspace/calendar/api/guides/sync
- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- https://deepstrike.io/blog/google-casa-security-assessment-2025
- https://www.nylas.com/blog/google-oauth-app-verification/
- https://www.nylas.com/blog/calendar-events-rrules/
- https://truto.one/blog/how-to-integrate-multiple-calendar-services-a-guide-for-saas-pms/
- https://syncdate.app/blog/how-calendar-sync-works
- https://www.cronofy.com/blog/best-calendar-apis · https://www.cronofy.com/build-or-buy-calendar-integrations

**Managed calendar-API's**
- https://www.nylas.com/pricing/ · https://www.nylas.com/products/calendar-api/
- https://developer.nylas.com/docs/dev-guide/platform/data-residency/
- https://www.cronofy.com/api-pricing · https://docs.cronofy.com/developers/plans-pricing/
- https://unified.to/calendar · https://www.merge.dev/ · https://www.recall.ai/pricing

**Markt & prijzen**
- https://calendly.com/pricing · https://cal.com/pricing · https://cal.com/europe
- https://acuityscheduling.com/ · https://www.microsoft.com/microsoft-365/business
- https://youcanbook.me/pricing · https://wf.savvycal.com/pricing
- https://zeeg.me/en/blog/post/calendly-alternative-gdpr · https://meetergo.com/en/magazine/calendly-alternative-gdpr
- https://www.salonized.com/en/pricing · https://www.treatwell.nl/

> Disclaimer: prijzen zijn overwegend USD uit VS-bronnen; reken om naar EUR en
> verifieer actuele tarieven vóór een offerte.
