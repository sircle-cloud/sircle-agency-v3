#!/usr/bin/env node
// sircle.agency — MainWP maintenance report generator
// Renders one branded PDF per managed website, in the sircle house style.
//
// Two data sources:
//   1. MainWP REST API  — set MAINWP_URL + MAINWP_CONSUMER_KEY + MAINWP_CONSUMER_SECRET
//   2. Local JSON file  — pass --data <file> (see sample-data.json for the shape)
//
// Usage:
//   node generate.js --data sample-data.json --out ~/Desktop/Q2-2026
//   MAINWP_URL=https://hub.example.com MAINWP_CONSUMER_KEY=... MAINWP_CONSUMER_SECRET=... \
//     node generate.js --out ~/Desktop/Q2-2026
//
// PDF rendering uses playwright-core against a preinstalled Chromium. No site build step.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { renderReport } = require('./template');

function parseArgs(argv) {
  const args = { out: path.join(process.cwd(), 'reports') };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--data') args.data = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--html') args.html = true; // also keep the intermediate HTML
  }
  return args;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---- MainWP REST API ----------------------------------------------------
// The REST API returns raw site-management data. It does NOT emit PDFs — that
// is exactly what this generator adds. Endpoints/shape vary per MainWP version,
// so mapMainWpSite() below is the single place to adapt to your dashboard.
async function fetchFromMainWp() {
  const base = process.env.MAINWP_URL?.replace(/\/$/, '');
  const key = process.env.MAINWP_CONSUMER_KEY;
  const secret = process.env.MAINWP_CONSUMER_SECRET;
  if (!base || !key || !secret) return null;

  const auth = new URLSearchParams({ consumer_key: key, consumer_secret: secret });
  const url = `${base}/wp-json/mainwp/v1/sites/all-sites?${auth}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`MainWP API ${res.status} ${res.statusText} — check credentials & REST API setting`);
  const raw = await res.json();
  const list = Array.isArray(raw) ? raw : Object.values(raw ?? {});
  return list.map(mapMainWpSite);
}

// Map a raw MainWP site record → the report data shape. Fields differ per
// MainWP version and installed extensions; fill these in against your dashboard.
function mapMainWpSite(s) {
  return {
    name: s.name || s.title || s.url,
    url: s.url,
    client: s.client_name || s.contact_name || '—',
    summary: {
      updates: Number(s.total_updates ?? 0),
      backups: Number(s.backups_count ?? 0),
      uptimePct: s.uptime != null ? Number(s.uptime) : null,
      security: s.security_status || '—',
    },
    updates: { core: s.core_updates ?? [], plugins: s.plugin_updates ?? [], themes: s.theme_updates ?? [] },
    backups: s.backups ?? [],
    uptime: { pct: s.uptime != null ? Number(s.uptime) : null, incidents: s.uptime_incidents ?? [] },
    security: s.security ?? { status: s.security_status || '—' },
    performance: s.performance ?? null,
  };
}

async function main() {
  const args = parseArgs(process.argv);

  let meta;
  if (args.data) {
    meta = JSON.parse(fs.readFileSync(args.data, 'utf8'));
  } else {
    const sites = await fetchFromMainWp();
    if (!sites) {
      console.error(
        'Geen databron. Geef --data <file.json> op, of zet MAINWP_URL / MAINWP_CONSUMER_KEY / MAINWP_CONSUMER_SECRET.'
      );
      process.exit(1);
    }
    // Period defaults to the current quarter label when pulling live; override in your wrapper if needed.
    meta = {
      period: { label: 'Q2 2026', from: '2026-04-01', to: '2026-06-30' },
      agency: { name: 'sircle.agency', location: 'Den Haag, NL', email: 'hello@sircle.agency' },
      sites,
    };
  }

  const sites = meta.sites ?? [];
  if (!sites.length) {
    console.error('Geen websites gevonden in de databron.');
    process.exit(1);
  }

  fs.mkdirSync(args.out, { recursive: true });
  // Use a pinned Chromium if provided (e.g. a preinstalled binary), else Playwright's own.
  const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();

  console.log(`Genereren van ${sites.length} rapport(en) → ${args.out}`);
  for (const site of sites) {
    const html = renderReport(site, meta);
    const slug = slugify(site.name || site.url);
    const label = slugify(meta.period?.label || 'rapport');
    if (args.html) fs.writeFileSync(path.join(args.out, `${slug}-${label}.html`), html);

    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdfPath = path.join(args.out, `${slug}-${label}.pdf`);
    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    console.log(`  ✓ ${path.basename(pdfPath)}`);
  }

  await browser.close();
  console.log('Klaar.');
}

main().catch((err) => {
  console.error('Fout:', err.message);
  process.exit(1);
});
