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
- `/sircle/intake` — publieke boekingspagina (kies slot → gegevens → bevestigen)
- `/sircle/intake?embed=1` — embed-/iframe-weergave
- `/admin/login` — admin-login (demo: `koen@sircle.example` / `demo1234`)
- `/admin` — dashboard: boekingen, agenda-koppeling, beheer

## Verifiëren

```bash
npm run typecheck  # tsc --noEmit — schoon
npm test           # 28 unit-tests: slot-engine, DST, buffers, dubbel-boeken, idempotentie,
                   #                admin (afspraaktypes/beschikbaarheid/annuleren), wachtwoord-hashing,
                   #                sync (reconciliatie-conflicten, webhook-dispatch), herinneringen
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
  auth/            ← sessies (HMAC-cookie), wachtwoorden (scrypt), Nylas OAuth + webhook-verificatie
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
    admin/                  login · dashboard · event-types (CRUD) · beschikbaarheid
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
- Tenant-onboarding (self-service registratie) + gebruikersbeheer per tenant.
- Herinneringsmails, verzetten door de gast, Stripe-facturatie, round-robin.
- `OAuth app-verificatie` (Google, "sensitive" scope) vóór echte klanten (§4).

> Losstaand van de statische agency-site: dit project heeft een eigen
> `package.json` en `node_modules` en raakt de site-tooling niet.
