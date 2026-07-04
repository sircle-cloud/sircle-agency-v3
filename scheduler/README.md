# SIRCLE Scheduler

White-label afsprakenplanner met twee-weg agenda-sync (Google/Outlook via een
managed calendar-API). Dit is het **Fase-1-fundament** uit het plan van aanpak
(`../docs/scheduling-saas/README.md`).

De architectuur volgt bewust de **eigen-domeinlaag-achter-dunne-adapters**-opzet
(§6/§7 van het plan): de kernlogica kent alleen _ports_ (interfaces); Nylas,
Prisma en Resend zijn inwisselbare _adapters_. Zo is later wisselen
(Nylas → Cronofy → zelf, of Postgres → iets anders) een adapter-swap, geen
herbouw.

## Direct draaien (geen keys nodig)

```bash
cd scheduler
npm install
npm run dev        # http://localhost:3000
```

Draait out-of-the-box op **in-memory data + mock-agenda + console-mail**. Open:

- `/` — demo-overzicht
- `/signup` — nieuwe organisatie aanmaken (multi-tenant onboarding)
- `/sircle/intake` — publieke boekingspagina (kies slot → gegevens → bevestigen)
- `/sircle/intake?embed=1` — embed-/iframe-weergave
- `/admin/login` — admin-login (demo: `koen@sircle.example` / `demo1234`)
- `/admin` — dashboard: boekingen, agenda-koppeling, beheer

## Verifiëren

```bash
npm run typecheck  # tsc --noEmit — schoon
npm test           # 36 unit-tests: slot-engine, DST, buffers, dubbel-boeken, idempotentie,
                   #                admin (afspraaktypes/beschikbaarheid/annuleren), wachtwoord-hashing,
                   #                sync (reconciliatie-conflicten, webhook-dispatch), herinneringen,
                   #                gast-self-service (token, annuleren, verzetten), onboarding,
                   #                round-robin (verdeling, unie-slots, fairness), billing
npm run build      # Next.js productie-build
```

## Architectuur

```
src/
  core/            ← EIGEN domeinlaag (puur, geen I/O, volledig getest)
    types.ts         domein-types (UTC + IANA-tijdzone, nooit vaste offset)
    time.ts          DST-veilige tijd-helpers (Luxon)
    availability.ts  slot-engine: rules + buffers + minNotice + busy → vrije slots
    booking.ts       BookingService: idempotentie → free/busy → atomaire persist → sync → mail
    errors.ts        domeinfouten met stabiele codes
  core/admin.ts    ← AdminService: afspraaktypes, beschikbaarheid, annuleren
  core/sync.ts     ← SyncService: reconciliatie-backstop + webhook-dispatch (§4)
  core/reminders.ts← ReminderService: herinneringsmails, idempotent (no-show-reductie)
  core/guest.ts    ← GuestBookingService: gast verzet/annuleert via beveiligde link
  core/onboarding.ts← OnboardingService: self-service registratie van nieuwe tenants
  core/billing.ts  ← BillingService: abonnementsplannen + Stripe checkout/webhook
  (round-robin zit in booking.ts: slots = unie van hosts, boeking → minst belaste vrije host)
  auth/            ← sessies (HMAC-cookie), wachtwoorden (scrypt), Nylas OAuth +
                     webhook-verificatie, gast-beheer-tokens
  ports/           ← de interfaces (anti-lock-in kern)
    index.ts         CalendarProvider · BookingRepository · Mailer
  adapters/        ← inwisselbare implementaties
    calendar/mock.ts      dev: in-memory agenda
    calendar/nylas.ts     prod: Nylas v3 (EU/Ierland) — Google/Outlook/iCloud
    repo/memory.ts        dev: in-memory, atomaire overlap-guard
    repo/prisma.ts        prod: PostgreSQL, vertaalt exclusion-constraint → SlotUnavailable
    mail/console.ts       dev: print naar console
    mail/resend.ts        prod: e-mail via Resend + .ics
    ics.ts                iCalendar-generator (RFC 5545)
    seed.ts               demo-tenant (SIRCLE Solutions, ma–vr 09:00–17:00)
  config.ts        ← composition root: kiest adapters op env (DB/CALENDAR/MAIL_DRIVER)
  app/             ← Next.js (App Router)
    [tenant]/[eventType]/   publieke boekingspagina + client-widget
    signup/                 self-service onboarding van een nieuwe organisatie
    manage/[bookingId]/     gast verzet/annuleert via beveiligde token-link
    admin/                  login · dashboard · event-types · beschikbaarheid · team · abonnement
    api/billing/…           checkout (Stripe) · dev-activate (mock)
    api/webhooks/stripe     HMAC-geverifieerde Stripe-webhook (abonnement bijwerken)
    api/…                   slots (GET) · bookings (POST) · embed-script
    api/oauth/nylas/…       hosted-auth start + callback (agenda koppelen)
    api/webhooks/nylas      HMAC-geverifieerde webhook + challenge-handshake
    api/cron/reconcile      periodieke reconciliatie-backstop (bearer-token)
    api/cron/reminders      herinneringsmails vóór de afspraak (bearer-token)
prisma/
  schema.prisma                       productie-datamodel (multi-tenant)
  migrations/manual/0001_*.sql        Postgres EXCLUSION-constraint (harde dubbel-boek-garantie)
test/                                  vitest
```

## Wat werkt (end-to-end geverifieerd)

- **Slot-engine** met tijdzones/DST (09:00 Amsterdam → 07:00 UTC zomer / 08:00 UTC winter),
  buffers, minimale aankondiging, geblokkeerde dagen, en agenda-bezet-tijd.
- **Dubbel-boek-preventie** in twee lagen: free/busy-check op het laatste moment
  **+** atomaire persist (in-memory guard in dev; Postgres exclusion-constraint in prod).
- **Idempotentie** via `idempotencyKey` (dubbele submit → zelfde boeking, geen duplicaat).
- **Bevestigingsmail + .ics**.
- **Embed-widget**: `<div data-sircle-tenant="…" data-sircle-event="…"></div>` +
  `<script src="…/api/embed-script">`.
- **Multi-tenant datamodel** (elke rij draagt `tenantId`; RLS in prod).
- **Admin-dashboard met auth (Fase 2)**: login (scrypt-wachtwoord + HMAC-sessie,
  geen externe auth-library), afspraaktypes aanmaken/bewerken/verwijderen,
  wekelijkse beschikbaarheid instellen, boekingen annuleren (verwijdert ook het
  agenda-event). Alles tenant-gescopet.
- **Nylas OAuth-koppelflow** bedraad (`/api/oauth/nylas/start` → callback →
  `CalendarConnection`): met echte Nylas-credentials koppelt een host zijn
  Google-/Outlook-agenda en gaat de twee-weg sync live.
- **Inbound sync + reconciliatie-backstop (Fase 3)**: HMAC-geverifieerde
  Nylas-webhook (met challenge-handshake), `grant.expired` deactiveert de
  koppeling, en een cron-endpoint detecteert **agenda-conflicten** (host plant
  extern iets over een boeking) — zichtbaar als waarschuwing in het dashboard.
  Omdat we Nylas gebruiken, ligt de zware channel-/subscription-renewal (§4)
  bij Nylas, niet bij ons; onze backstop vangt gemiste webhooks op.
- **Herinneringsmails (Fase 3)**: `/api/cron/reminders` stuurt idempotent (via
  `reminderSentAt`) een herinnering voor afspraken die binnen 24u starten —
  no-show-reductie als concreet verkoopargument (§5).
- **Gast-self-service (Fase 3)**: elke bevestigingsmail bevat een HMAC-beveiligde
  link (`/manage/<id>?token=…`) waarmee de gast zonder account kan **verzetten of
  annuleren** — inclusief twee-weg agenda-sync (oud event weg, nieuw event erin)
  en bevestigingsmail. Sluit de boekingslevenscyclus.
- **Tenant-onboarding (Fase 2)**: `/signup` maakt self-service een nieuwe
  organisatie + eerste admin aan, met directe defaults (werktijden ma–vr +
  starter-afspraaktype), zodat een klant meteen een werkende boekingspagina
  heeft. Slug- en e-mail-uniciteit afgedwongen. Fundament voor white-label uitrol.
- **Round-robin / team-scheduling (Fase 4)**: teamleden toevoegen (`/admin/team`)
  en een afspraaktype over meerdere hosts verdelen. Slots = **unie** van de
  hosts (aanbod zolang één host vrij is); een boeking gaat naar de vrije host met
  de **minste aankomende afspraken** (eerlijke verdeling). Bij Calendly zit dit
  achter een betaald plan — hier standaard.
- **Stripe-facturatie (Fase 4)**: flat-rate abonnementsplannen (Solo €15 /
  Praktijk €49 / White-label €99 per maand) via Stripe Checkout, met
  HMAC-geverifieerde webhook die het tenant-abonnement bijwerkt. Zonder
  Stripe-key draait billing in mock-modus (dev-activatie), zodat de flow lokaal
  te testen is. `/admin/billing` toont het plan en de upgrade-opties.

## Naar productie (adapters inpluggen)

Zet in `.env.local` (zie `.env.example`):

```bash
DB_DRIVER=prisma        # + DATABASE_URL (EU-Postgres)
CALENDAR_DRIVER=nylas   # + NYLAS_API_KEY, NYLAS_API_URI=https://api.eu.nylas.com
MAIL_DRIVER=resend      # + RESEND_API_KEY, RESEND_FROM
```

Daarna:

```bash
npm run prisma:migrate
psql "$DATABASE_URL" -f prisma/migrations/manual/0001_booking_no_overlap.sql
```

De composition root (`src/config.ts`) pakt de gekozen adapters automatisch op —
de rest van de code verandert niet.

## Nog te bouwen (volgende fasen, zie het plan §8)

- **Nylas-credentials koppelen** (`NYLAS_CLIENT_ID` + `NYLAS_API_KEY` +
  `NYLAS_WEBHOOK_SECRET`) om OAuth, sync én webhooks live te testen met een
  echte Google-/Outlook-agenda.
- Reconciliatie-cron daadwerkelijk plannen (bv. Vercel Cron / externe scheduler
  die `/api/cron/reconcile` elke ~10 min aanroept) + host-notificatie bij conflict.
- Eigen domein/branding per tenant (custom subdomein/logo).
- Stripe-account koppelen (`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`) om
  echte betalingen live te testen; nu draait billing in mock-modus.
- Facturen/betaalgeschiedenis + Stripe Billing Portal (opzeggen/wijzigen).
- `OAuth app-verificatie` (Google, "sensitive" scope) vóór echte klanten (§4).

> Losstaand van de statische agency-site: dit project heeft een eigen
> `package.json` en `node_modules` en raakt de site-tooling niet.
