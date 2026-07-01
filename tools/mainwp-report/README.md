# MainWP Maintenance Reports

Genereert per beheerde website een **PDF-onderhoudsrapport** in de sircle-huisstijl
(dark-green / goud / Kulim Park). Bedoeld voor kwartaalrapportages (Q1–Q4) naar klanten.

De MainWP REST API levert de ruwe data; deze tool doet de opmaak → PDF.
Er is **geen site-build** nodig — het draait los van de website zelf.

## Vereisten

- Node.js 18+ (`fetch` is ingebouwd)
- Chromium via Playwright. Óf `npm i playwright-core` + `npx playwright install chromium`,
  óf wijs met `CHROMIUM_PATH` naar een bestaande Chromium/Chrome-binary.

```bash
npm install --no-save playwright-core
```

## Snel proberen (voorbeelddata)

```bash
node generate.js --data sample-data.json --out ./_preview
```

Levert één PDF per site in `./_preview/`. `sample-data.json` bevat **fictieve** cijfers
en laat zien welke velden het template gebruikt.

## Echte data via de MainWP REST API

1. In je MainWP-dashboard: **Settings → REST API** → schakel in en genereer een
   **Consumer Key + Consumer Secret** (werkt zoals de WooCommerce REST API).
2. Zet de credentials als omgevingsvariabelen en draai:

```bash
export MAINWP_URL="https://jouw-mainwp-hub.nl"
export MAINWP_CONSUMER_KEY="ck_..."
export MAINWP_CONSUMER_SECRET="cs_..."

# schrijf de PDF's rechtstreeks naar een map op je desktop:
node generate.js --out ~/Desktop/Q2-2026
```

> De REST API geeft **ruwe sitedata, geen PDF** — dat is precies wat deze tool toevoegt.
> Endpoint-namen en veldnamen verschillen per MainWP-versie en per geïnstalleerde
> extensie (Client Reports, backup, uptime, security). Pas daarom zo nodig
> **`mapMainWpSite()`** in `generate.js` aan op de exacte JSON die jouw dashboard teruggeeft.
> Velden voor backups, uptime en security komen vaak uit losse extensies; ontbreken ze,
> dan toont het rapport netjes "geen data" i.p.v. te breken.

## Taal per site (NL / EN)

Elke site kan een `lang` krijgen: `"nl"` (standaard) of `"en"`. Het hele rapport
— titels, labels, tabelkoppen, datums en de voettekst — schakelt automatisch mee.
De statuswaarden in de **data** volgen de taal (bv. `"Veilig"`/`"Schoon"` in NL,
`"Safe"`/`"Clean"` in EN); die worden herkend voor de juiste kleurmarkering.

```json
{ "name": "Newlong", "url": "newlong.eu", "lang": "en", "security": { "status": "Safe" } }
```

Bij de REST API-route mapt `mapMainWpSite()` de taal uit `report_language` of
`language`; pas dat veld aan naar wat jouw dashboard levert.

## Opties

| Flag | Betekenis |
|------|-----------|
| `--data <file>` | Lees uit een lokaal JSON-bestand i.p.v. de API |
| `--out <map>` | Uitvoermap (default `./reports`) |
| `--html` | Bewaar ook de tussenliggende HTML per site |
| `CHROMIUM_PATH` | Pad naar een bestaande Chromium-binary (env var) |

## Bestanden

- `template.js` — het merk-template (HTML/CSS), één functie `renderReport(site, meta)`
- `generate.js` — CLI: data ophalen (API of JSON) → HTML → PDF
- `sample-data.json` — voorbeelddataset met de verwachte datastructuur

## Let op — géén klantdata committen

Gegenereerde rapporten en previews (`reports/`, `_preview/`, PDF's) staan in
`.gitignore` en horen **niet** in deze publieke website-repo. Alleen de tool zelf
wordt versiebeheerd; de rapporten zet je lokaal weg (bv. op je desktop).
