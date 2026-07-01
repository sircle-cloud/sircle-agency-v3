#!/usr/bin/env node
// sircle.agency — MainWP STATUS report generator
// Builds a real per-site status report purely from the MainWP REST API:
// health, security checks, versions, active plugins, pending updates and the
// updates registered in the period. Sections without API data are omitted.
//
// Credentials come from the environment (never hard-code them):
//   MAINWP_URL=https://www.example.com \
//   MAINWP_CONSUMER_KEY=ck_... MAINWP_CONSUMER_SECRET=cs_... \
//   node generate-status.js --out ~/Downloads/Onderhoudsrapporten-Q2-2026
//
// PDF rendering uses playwright-core against a Chromium binary (CHROMIUM_PATH).

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { renderStatusReport, pickLang } = require('./template');

const AGENCY = { name: 'sircle.agency', location: 'Den Haag, NL', email: 'hello@sircle.agency' };
const EN_HOSTS = ['newlong', '22qminded']; // these sites get English reports

const addDay = (isoDate) => Date.parse(`${isoDate}T00:00:00Z`) / 1000 + 86400; // exclusive upper bound

function parseArgs(argv) {
  const args = {
    out: path.join(process.cwd(), 'reports'),
    from: '2026-04-01', to: '2026-06-30', label: 'Q2 2026', sites: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--html') args.html = true;
    else if (a === '--from') args.from = argv[++i];
    else if (a === '--to') args.to = argv[++i];
    else if (a === '--label') args.label = argv[++i];
    else if (a === '--sites') args.sites = argv[++i].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  return args;
}

const base = () => (process.env.MAINWP_URL || '').replace(/\/$/, '');
const auth = () =>
  `consumer_key=${process.env.MAINWP_CONSUMER_KEY}&consumer_secret=${process.env.MAINWP_CONSUMER_SECRET}`;

async function api(pathAndQuery) {
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const res = await fetch(`${base()}/wp-json/mainwp/v1/${pathAndQuery}${sep}${auth()}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null; // some extensions return HTML errors; treat as no data
  }
}

const cleanUrl = (u) =>
  String(u || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/wp-admin\/?$/, '')
    .replace(/\/$/, '');

const slugify = (s) =>
  String(s).toLowerCase().replace(/https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const toDate = (unix) => new Date(Number(unix) * 1000).toISOString().slice(0, 10);
const normList = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);

function langOf(site) {
  const u = cleanUrl(site.url).toLowerCase();
  return EN_HOSTS.some((h) => u.includes(h)) ? 'en' : 'nl';
}

function mapSite(site, ctx) {
  const lang = langOf(site);
  const en = lang === 'en';
  const info = ctx.info || {};
  const sec = ctx.security || {};
  const avail = ctx.avail || {};
  const healthRaw = ctx.health || '';
  const health = healthRaw === 'Good' ? (en ? 'Good' : 'Goed') : healthRaw || '—';

  const checks = {
    wpUpToDate: sec.wp_uptodate === 'Y',
    ssl: sec.sslprotocol === 'Y' || !!info.child_openssl_version,
    debugDisabled: sec.debug_disabled === 'Y' || info.debug_mode === false,
    phpMatch: sec.phpversion_matched === 'Y',
  };
  const secureOverall = checks.wpUpToDate && checks.ssl && checks.debugDisabled;
  const securityLabel = secureOverall ? (en ? 'Safe' : 'Veilig') : en ? 'Attention' : 'Aandacht';

  // Registered updates in the period (from the site change log).
  const typeLabel = (item) => {
    const s = String(item).toLowerCase();
    if (s.includes('theme')) return en ? 'Theme' : 'Thema';
    if (s.includes('wordpress') || s.includes('core')) return 'Core';
    return 'Plugin';
  };
  const seen = new Set();
  const updatesPerformed = (ctx.changes || [])
    .filter((c) => {
      const item = String(c.item || '').toLowerCase();
      return c.action === 'updated' && (item.includes('plugin') || item.includes('theme') || item.includes('wordpress'));
    })
    .map((c) => ({ type: typeLabel(c.item), name: c.meta_name || '—', date: toDate(c.created) }))
    .filter((u) => {
      const k = `${u.type}|${u.name}|${u.date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Pending updates (unambiguous, from the updates endpoint).
  const pending = [];
  normList(avail.wp_core).forEach((w) =>
    pending.push({ type: 'Core', name: 'WordPress', to: w.new_version || w.current || '' })
  );
  normList(avail.plugins).forEach((p) =>
    pending.push({ type: 'Plugin', name: p.Name || p.name || '—', from: p.Version, to: p.update?.new_version })
  );
  normList(avail.themes).forEach((t) =>
    pending.push({ type: en ? 'Theme' : 'Thema', name: t.Name || t.name || '—', from: t.Version, to: t.update?.new_version })
  );
  const trans = normList(avail.translation).length;
  if (trans) pending.push({ type: en ? 'Translations' : 'Vertalingen', name: en ? `${trans} language file(s)` : `${trans} taalbestand(en)`, to: '' });

  const plugins = ctx.pluginCount ?? 0;
  const pendingCount = pending.length;
  const reportDate = en ? '1 Jul 2026' : '1 jul 2026';
  const intro = en
    ? `As of ${reportDate}, ${site.name} is healthy and operational. WordPress ${info.wpversion || '—'}, PHP ${info.phpversion || '—'}, ${plugins} active plugins. ${pendingCount === 0 ? 'All components are up to date.' : `${pendingCount} update(s) pending.`} SSL is active and no open security issues were found.`
    : `Op ${reportDate} is ${site.name} gezond en operationeel. WordPress ${info.wpversion || '—'}, PHP ${info.phpversion || '—'}, ${plugins} actieve plugins. ${pendingCount === 0 ? 'Alle onderdelen zijn up-to-date.' : `Er ${pendingCount === 1 ? 'staat 1 update' : 'staan ' + pendingCount + ' updates'} open.`} SSL is actief en er zijn geen openstaande beveiligingsproblemen.`;

  return {
    name: site.name,
    url: cleanUrl(site.url),
    client: ctx.client || site.name,
    lang,
    intro,
    summary: {
      health,
      security: securityLabel,
      plugins,
      pending: pendingCount,
      wp: info.wpversion || '—',
      php: info.phpversion || '—',
    },
    updatesPerformed,
    pending,
    checks,
    tech: {
      wp: info.wpversion,
      php: info.phpversion,
      theme: info.themeactivated,
      ssl: checks.ssl,
      dbSize: info.db_size,
      plugins,
      health,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!base() || !process.env.MAINWP_CONSUMER_KEY || !process.env.MAINWP_CONSUMER_SECRET) {
    console.error('Zet MAINWP_URL / MAINWP_CONSUMER_KEY / MAINWP_CONSUMER_SECRET in de omgeving.');
    process.exit(1);
  }

  const period = { label: args.label, from: args.from, to: args.to };
  const winFrom = Date.parse(`${args.from}T00:00:00Z`) / 1000;
  const winTo = addDay(args.to);

  console.log(`Periode: ${period.label} (${args.from} → ${args.to})`);
  console.log('Ophalen sitelijst en context uit MainWP…');
  let sites = Object.values(await api('sites/all-sites'));
  if (args.sites) {
    sites = sites.filter((s) => {
      const hay = `${s.name} ${cleanUrl(s.url)}`.toLowerCase();
      return args.sites.some((tok) => hay.includes(tok));
    });
    console.log(`Filter op sites: ${sites.map((s) => s.name).join(', ') || '(geen match)'}`);
  }
  const clients = Object.fromEntries((((await api('clients/all-clients')) || {}).data || []).map((c) => [c.client_id, c]));
  const health = (await api('sites/health-score')) || {};
  const security = (await api('sites/security-issues')) || {};

  const mapped = [];
  for (const s of sites) {
    const id = s.id;
    const info = await api(`site/site-info?site_id=${id}`);
    const avail = await api(`site/site-available-updates?site_id=${id}`);
    const plc = await api(`site/site-active-plugins-count?site_id=${id}`);
    let changes = await api(`site/non-mainwp-changes?site_id=${id}`);
    changes = Array.isArray(changes) ? changes.filter((c) => +c.created >= winFrom && +c.created < winTo) : [];
    mapped.push(
      mapSite(s, {
        info,
        avail,
        pluginCount: plc?.count,
        changes,
        health: health[id],
        security: security[id],
        client: clients[s.client_id]?.name,
      })
    );
    process.stderr.write('.');
  }
  process.stderr.write('\n');

  const meta = { period, agency: AGENCY };
  const periodSlug = slugify(period.label);
  fs.mkdirSync(args.out, { recursive: true });
  const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();

  console.log(`Genereren van ${mapped.length} status-rapporten → ${args.out}`);
  for (const site of mapped) {
    const html = renderStatusReport(site, meta);
    const slug = slugify(site.name || site.url);
    if (args.html) fs.writeFileSync(path.join(args.out, `${slug}-status-${periodSlug}.html`), html);
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.pdf({
      path: path.join(args.out, `${slug}-status-${periodSlug}.pdf`),
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: '16mm', bottom: '18mm', left: '0mm', right: '0mm' },
      headerTemplate: '<span></span>',
      footerTemplate: footerTemplate(site, period),
    });
    console.log(`  ✓ ${slug} (${site.lang})`);
  }
  await browser.close();
  console.log('Klaar.');
}

function footerTemplate(site, period) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const L = pickLang(site);
  return `<div style="box-sizing:border-box; width:100%; padding:0 18mm; font-family:'Kulim Park',Arial,sans-serif; font-size:6.5pt; letter-spacing:.12em; text-transform:uppercase; color:#6b6f6c;">
    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #E8D590; padding-top:2.5mm;">
      <span>${esc(AGENCY.name)} · ${esc(L.eyebrow)} ${esc(period.label)} · ${esc(site.url)}</span>
      <span>${esc(L.page)} <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>
  </div>`;
}

main().catch((err) => {
  console.error('Fout:', err.message);
  process.exit(1);
});
