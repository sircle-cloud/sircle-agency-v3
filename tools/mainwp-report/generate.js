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
const { renderReport, pickLang } = require('./template');

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

// Running footer for every page (Chromium fills .pageNumber / .totalPages).
// Uses the site's language for the labels, matching the report body.
function footerTemplate(site, meta) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const L = pickLang(site);
  const agency = meta.agency ?? {};
  const period = meta.period ?? {};
  return `<div style="width:100%; padding:0 18mm; font-family:'Kulim Park',Arial,sans-serif; font-size:6.5pt; letter-spacing:.12em; text-transform:uppercase; color:#6b6f6c; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #E8D590; margin:0 18mm; padding-top:2.5mm; width:auto;">
    <span>${esc(agency.name ?? 'sircle.agency')} · ${esc(L.eyebrow)} ${esc(period.label)} · ${esc(site.url)}</span>
    <span>${esc(L.page)} <span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;
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
// The richest source is MainWP's per-site action/audit log — that feeds the
// full "handelingen" section. Map it from whichever endpoint your setup exposes
// (e.g. the Client Reports tokens or the actions log), then normalise each entry
// to { date, category, action, detail }.
function mapMainWpSite(s) {
  const updates = {
    core: s.core_updates ?? [],
    plugins: s.plugin_updates ?? [],
    themes: s.theme_updates ?? [],
  };
  return {
    name: s.name || s.title || s.url,
    url: s.url,
    client: s.client_name || s.contact_name || '—',
    // Report language: 'en' or 'nl' (default). Map from your own field/tag.
    lang: s.report_language || s.language || 'nl',
    intro: s.report_intro || s.summary_text || '',
    // Full activity log — normalise each MainWP action-log entry.
    activity: (s.actions ?? s.activity ?? s.audit_log ?? []).map((a) => ({
      date: a.date || a.timestamp,
      category: a.category || a.type || 'onderhoud',
      action: a.action || a.message || a.description,
      detail: a.detail || a.context || '',
    })),
    summary: {
      actions: Number(s.actions_count ?? (s.actions ?? s.activity ?? []).length ?? 0),
      updates: Number(s.total_updates ?? 0),
      backups: Number(s.backups_count ?? (s.backups ?? []).length ?? 0),
      uptimePct: s.uptime != null ? Number(s.uptime) : null,
      threatsBlocked: Number(s.firewall_blocks ?? s.threats_blocked ?? 0),
      security: s.security_status || '—',
    },
    updates,
    security: s.security ?? {
      status: s.security_status || '—',
      scans: s.scans_count,
      threats: s.threats_found,
      firewallBlocks: s.firewall_blocks,
      loginBlocks: s.login_blocks,
      spamBlocked: s.spam_blocked,
      blacklist: s.blacklist_status,
      lastScan: s.last_scan,
    },
    backups: s.backups ?? [],
    uptime: {
      pct: s.uptime != null ? Number(s.uptime) : null,
      monthly: s.uptime_monthly ?? [],
      incidents: s.uptime_incidents ?? [],
    },
    performance: s.performance ?? null,
    analytics: s.analytics ?? null,
    health: s.health ?? null,
    recommendations: s.recommendations ?? [],
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
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: '12mm', bottom: '14mm', left: '0mm', right: '0mm' },
      headerTemplate: '<span></span>',
      footerTemplate: footerTemplate(site, meta),
    });
    console.log(`  ✓ ${path.basename(pdfPath)}`);
  }

  await browser.close();
  console.log('Klaar.');
}

main().catch((err) => {
  console.error('Fout:', err.message);
  process.exit(1);
});
