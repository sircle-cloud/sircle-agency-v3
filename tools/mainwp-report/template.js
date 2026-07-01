// sircle.agency — Maintenance report template (HTML → PDF)
// Renders one branded, multi-page maintenance report per managed website, in the
// sircle house style (dark-green / gold / Kulim Park). Pure string template.

const LOGO_WHITE = `<svg viewBox="0 0 4000 1694" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="sircle">
<path d="M1454.68 1019.28C1454.68 1135.65 1358.37 1231.96 1239.99 1231.96H646.078V1095.52H1239.99C1282.12 1095.52 1316.23 1061.41 1316.23 1019.28C1316.23 977.14 1282.12 943.031 1239.99 943.031H1093.52C975.135 943.031 878.826 846.721 878.826 730.347C878.826 613.973 977.142 517.664 1093.52 517.664H1384.45V654.102H1093.52C1051.38 654.102 1017.27 688.212 1017.27 730.347C1017.27 772.483 1051.38 806.592 1093.52 806.592H1239.99C1358.37 806.592 1454.68 902.902 1454.68 1019.28Z" fill="#F2E2A4"/>
<path d="M1625.22 519.669H1488.78C1540.95 617.985 1569.04 732.353 1569.04 850.733C1569.04 991.184 1528.91 1121.6 1458.69 1231.96H1601.14C1659.33 1117.59 1691.43 987.171 1691.43 850.733C1691.43 732.353 1667.36 619.992 1625.22 519.669ZM844.714 1573.05C445.431 1573.05 120.387 1248.01 120.387 848.727C120.387 449.444 445.431 124.4 844.714 124.4C1065.42 124.4 1264.06 222.715 1396.49 379.218H1550.98C1398.49 150.483 1139.66 0 846.72 0C379.218 0 0 379.218 0 846.72C0 1314.22 379.218 1693.44 846.72 1693.44C1117.59 1693.44 1360.37 1565.03 1514.87 1366.39H1350.34C1217.91 1494.8 1041.35 1573.05 844.714 1573.05Z" fill="#F2E2A4"/>
</svg>`;

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return esc(iso);
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
};

const statusClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('veilig') || s.includes('ok') || s.includes('gezond') || s.includes('geslaagd')) return 'is-good';
  if (s.includes('waarschuw') || s.includes('let op') || s.includes('warn') || s.includes('verlopen')) return 'is-warn';
  if (s.includes('risico') || s.includes('kritiek') || s.includes('threat') || s.includes('mislukt')) return 'is-bad';
  return 'is-neutral';
};

// Category → colored dot label for the activity log
const CAT = {
  update: { label: 'Update', cls: 'c-update' },
  security: { label: 'Security', cls: 'c-security' },
  backup: { label: 'Backup', cls: 'c-backup' },
  performance: { label: 'Performance', cls: 'c-perf' },
  onderhoud: { label: 'Onderhoud', cls: 'c-maint' },
  monitoring: { label: 'Monitoring', cls: 'c-monitor' },
  content: { label: 'Content', cls: 'c-content' },
};
const catMeta = (c) => CAT[String(c || '').toLowerCase()] || { label: esc(c || 'Actie'), cls: 'c-default' };

// ---- Sections -----------------------------------------------------------

function scorecard(summary = {}) {
  const cards = [
    { label: 'Handelingen', value: summary.actions ?? 0 },
    { label: 'Updates', value: summary.updates ?? 0 },
    { label: 'Backups', value: summary.backups ?? 0 },
    { label: 'Uptime', value: summary.uptimePct != null ? summary.uptimePct.toFixed(2) : '—', unit: '%' },
    { label: 'Bedreigingen geblokkeerd', value: summary.threatsBlocked ?? 0 },
    { label: 'Security', value: esc(summary.security ?? '—'), status: statusClass(summary.security) },
  ];
  return `<div class="scorecard">${cards
    .map(
      (c) => `<div class="score ${c.status || ''}">
        <div class="score-value">${c.value}<span class="score-unit">${c.unit || ''}</span></div>
        <div class="score-label">${c.label}</div>
      </div>`
    )
    .join('')}</div>`;
}

function summarySection(intro) {
  if (!intro) return '';
  return section('Management­samenvatting', `<p class="prose">${esc(intro)}</p>`);
}

// The full activity log — every performed action, dated. This is the core of a
// real maintenance report: the complete "handelingenlog".
function activitySection(activity = []) {
  if (!activity.length) return '';
  const rows = activity
    .map((a) => {
      const m = catMeta(a.category);
      return `<tr>
        <td class="t-date">${fmtDate(a.date)}</td>
        <td><span class="tag ${m.cls}">${m.label}</span></td>
        <td class="t-action">${esc(a.action)}${a.detail ? `<span class="t-detail">${esc(a.detail)}</span>` : ''}</td>
      </tr>`;
    })
    .join('');
  return section(
    'Uitgevoerde handelingen',
    `<p class="prose sub">Volledig logboek van alle onderhoudsacties in deze periode (${activity.length} handelingen).</p>
     <table class="tbl log"><thead><tr><th>Datum</th><th>Categorie</th><th>Handeling</th></tr></thead><tbody>${rows}</tbody></table>`
  );
}

function updatesSection(updates = {}) {
  const rows = [];
  const push = (type, items = []) =>
    items.forEach((i) =>
      rows.push(
        `<tr><td class="t-type">${esc(type)}</td><td>${esc(i.name)}</td><td class="t-ver">${esc(i.from ?? '')} → ${esc(
          i.to ?? ''
        )}</td><td class="t-date">${fmtDate(i.date)}</td></tr>`
      )
    );
  push('Core', updates.core);
  push('Plugin', updates.plugins);
  push('Thema', updates.themes);
  const total = rows.length;
  if (!total) return section('Updates', `<p class="empty">Geen updates in deze periode.</p>`);
  return section(
    'Updates in detail',
    `<p class="prose sub">${total} componenten bijgewerkt naar de nieuwste versie.</p>
     <table class="tbl"><thead><tr><th>Type</th><th>Naam</th><th>Versie</th><th>Datum</th></tr></thead><tbody>${rows.join(
       ''
     )}</tbody></table>`
  );
}

function securitySection(security = {}) {
  const metrics = [
    ['Status', `<span class="pill ${statusClass(security.status)}">${esc(security.status ?? '—')}</span>`],
    ['Malware-scans', esc(security.scans ?? 0)],
    ['Bedreigingen gevonden', esc(security.threats ?? 0)],
    ['Aanvallen geblokkeerd (firewall)', esc(security.firewallBlocks ?? 0)],
    ['Verdachte logins geblokkeerd', esc(security.loginBlocks ?? 0)],
    ['Spam tegengehouden', esc(security.spamBlocked ?? 0)],
    ['Blacklist-status', `<span class="pill ${statusClass(security.blacklist)}">${esc(security.blacklist ?? 'Schoon')}</span>`],
    ['Laatste scan', fmtDate(security.lastScan)],
  ];
  return section('Security & firewall', kv(metrics));
}

function backupsSection(backups = []) {
  if (!backups.length) return section('Backups', `<p class="empty">Geen backups geregistreerd.</p>`);
  const rows = backups
    .map(
      (b) =>
        `<tr><td class="t-date">${fmtDate(b.date)}</td><td>${esc(b.type)}</td><td>${esc(
          b.size ?? '—'
        )}</td><td>${esc(b.location ?? '—')}</td><td><span class="pill ${statusClass(b.status)}">${esc(
          b.status ?? 'OK'
        )}</span></td></tr>`
    )
    .join('');
  return section(
    'Backups',
    `<table class="tbl"><thead><tr><th>Datum</th><th>Type</th><th>Grootte</th><th>Opslag</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`
  );
}

function uptimeSection(uptime = {}) {
  const incidents = uptime.incidents ?? [];
  const monthly = uptime.monthly ?? [];
  const monthlyBlock = monthly.length
    ? `<table class="tbl"><thead><tr><th>Maand</th><th>Beschikbaarheid</th><th>Downtime</th></tr></thead><tbody>${monthly
        .map(
          (m) =>
            `<tr><td>${esc(m.month)}</td><td>${m.pct != null ? m.pct.toFixed(2) : '—'}%</td><td>${esc(
              m.downtime ?? '—'
            )}</td></tr>`
        )
        .join('')}</tbody></table>`
    : '';
  const incidentBlock = incidents.length
    ? `<h3>Incidenten</h3><table class="tbl"><thead><tr><th>Start</th><th>Duur</th><th>Oorzaak</th></tr></thead><tbody>${incidents
        .map(
          (i) =>
            `<tr><td class="t-date">${fmtDate(i.start)}</td><td>${esc(i.duration ?? '—')}</td><td>${esc(
              i.note ?? '—'
            )}</td></tr>`
        )
        .join('')}</tbody></table>`
    : `<p class="empty">Geen downtime-incidenten geregistreerd.</p>`;
  return section(
    'Uptime & beschikbaarheid',
    `<p class="lead"><strong>${
      uptime.pct != null ? uptime.pct.toFixed(2) : '—'
    }%</strong> beschikbaarheid over de hele periode.</p>${monthlyBlock}${incidentBlock}`
  );
}

function performanceSection(perf) {
  if (!perf) return '';
  return section(
    'Performance',
    kv([
      ['PageSpeed mobiel', esc(perf.pageSpeedMobile ?? '—')],
      ['PageSpeed desktop', esc(perf.pageSpeedDesktop ?? '—')],
      ['Gem. laadtijd', perf.loadTime ? `${esc(perf.loadTime)} s` : '—'],
      ['Core Web Vitals', `<span class="pill ${statusClass(perf.cwv)}">${esc(perf.cwv ?? '—')}</span>`],
      ['Laatste meting', fmtDate(perf.lastCheck)],
    ])
  );
}

function analyticsSection(a) {
  if (!a) return '';
  const top = (a.topPages ?? [])
    .map((p) => `<tr><td>${esc(p.path)}</td><td class="t-num">${esc(p.views)}</td></tr>`)
    .join('');
  return section(
    'Bezoekersstatistieken',
    `${kv([
      ['Unieke bezoekers', esc(a.visitors ?? '—')],
      ['Paginaweergaven', esc(a.pageviews ?? '—')],
      ['Gem. sessieduur', esc(a.avgSession ?? '—')],
      ['Bouncepercentage', a.bounceRate != null ? `${esc(a.bounceRate)}%` : '—'],
    ])}${
      top
        ? `<h3>Best bezochte pagina's</h3><table class="tbl"><thead><tr><th>Pagina</th><th>Weergaven</th></tr></thead><tbody>${top}</tbody></table>`
        : ''
    }`
  );
}

function healthSection(h) {
  if (!h) return '';
  return section(
    'Techniek & health',
    kv([
      ['SSL-certificaat', `<span class="pill ${statusClass(h.ssl)}">${esc(h.ssl ?? '—')}</span>`],
      ['SSL verloopt op', fmtDate(h.sslExpiry)],
      ['PHP-versie', esc(h.phpVersion ?? '—')],
      ['WordPress-versie', esc(h.wpVersion ?? '—')],
      ['Actieve plugins', esc(h.activePlugins ?? '—')],
      ['Gebroken links', esc(h.brokenLinks ?? 0)],
    ])
  );
}

function recommendationsSection(recs = []) {
  if (!recs.length) return '';
  return section(
    'Aanbevelingen',
    `<ul class="recs">${recs.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
  );
}

// ---- Layout helpers -----------------------------------------------------

function kv(pairs) {
  return `<div class="kv">${pairs
    .map(([k, v]) => `<div><span>${esc(k)}</span><strong>${v}</strong></div>`)
    .join('')}</div>`;
}

function section(title, inner) {
  return `<section class="block"><h2>${title}</h2>${inner}</section>`;
}

function renderReport(site, meta) {
  const period = meta.period ?? {};
  const agency = meta.agency ?? {};
  return `<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8">
<title>Onderhoudsrapport — ${esc(site.name)} — ${esc(period.label)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Kulim+Park:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --dark-green:#0C180F; --dark-green-deep:#060D08; --mid-green:#3F6F45; --sage:#8FAF8A;
    --gold:#F2E2A4; --gold-warm:#E8D590; --copper:#B89A5A; --cream:#F3EFE8; --warm-white:#FFF8EE;
    --beige:#E9E2D6; --ink:#1C1E1D; --muted:#6b6f6c;
  }
  *{box-sizing:border-box; margin:0; padding:0;}
  @page{ size:A4; margin:0; }
  html,body{ font-family:'Kulim Park','Helvetica Neue',Arial,sans-serif; color:var(--ink); background:#fff; font-size:10pt; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  /* Page margins (top/bottom for the running header+footer) are set via
     Playwright's page.pdf() margin option; the cover bleeds up into the top
     margin with a negative margin-top so page 1 stays full-bleed. */

  /* ---- Cover header band (page 1) ---- */
  .head{ background:var(--dark-green); color:var(--warm-white); padding:24mm 18mm 15mm; position:relative; overflow:hidden; margin-top:-12mm; }
  .head::after{ content:''; position:absolute; right:-40mm; top:-40mm; width:120mm; height:120mm; border-radius:50%; border:1px solid rgba(242,226,164,.14); }
  .head::before{ content:''; position:absolute; right:-18mm; bottom:-60mm; width:90mm; height:90mm; border-radius:50%; border:1px solid rgba(242,226,164,.10); }
  .brand{ width:42mm; margin-bottom:12mm; }
  .brand svg{ width:100%; height:auto; display:block; }
  .eyebrow{ text-transform:uppercase; letter-spacing:.32em; font-size:8pt; font-weight:600; color:var(--gold); margin-bottom:5mm; }
  .head h1{ font-weight:300; font-size:25pt; line-height:1.1; letter-spacing:-.01em; }
  .head h1 strong{ font-weight:700; color:var(--gold); }
  .meta-row{ display:flex; gap:12mm; margin-top:9mm; padding-top:5mm; border-top:1px solid rgba(242,226,164,.22); }
  .meta-row div span{ display:block; text-transform:uppercase; letter-spacing:.18em; font-size:6.5pt; color:var(--sage); margin-bottom:2mm; }
  .meta-row div strong{ font-weight:600; font-size:10pt; color:var(--warm-white); }

  /* ---- Scorecard ---- */
  .content{ padding:0 18mm; }
  .scorecard{ display:grid; grid-template-columns:repeat(3,1fr); gap:4mm; margin-top:-16mm; margin-bottom:11mm; position:relative; z-index:2; }
  .score{ background:var(--warm-white); border:1px solid var(--beige); border-top:2px solid var(--gold); border-radius:2mm; padding:5mm; box-shadow:0 4mm 14mm rgba(12,24,15,.08); }
  .score-value{ font-size:19pt; font-weight:700; color:var(--dark-green); line-height:1; }
  .score-unit{ font-size:10pt; font-weight:400; color:var(--muted); margin-left:1mm; }
  .score-label{ text-transform:uppercase; letter-spacing:.12em; font-size:6.5pt; font-weight:600; color:var(--muted); margin-top:3mm; }
  .score.is-good{ border-top-color:var(--mid-green); } .score.is-good .score-value{ color:var(--mid-green); }
  .score.is-warn{ border-top-color:var(--copper); } .score.is-warn .score-value{ color:var(--copper); }
  .score.is-bad{ border-top-color:#b0403a; } .score.is-bad .score-value{ color:#b0403a; }

  /* ---- Content blocks ---- */
  .block{ margin-bottom:8mm; break-inside:avoid; }
  .block h2{ font-weight:600; font-size:11pt; letter-spacing:.02em; color:var(--dark-green); padding-bottom:2.5mm; margin-bottom:4mm; border-bottom:1px solid var(--gold-warm); display:flex; align-items:center; gap:3mm; }
  .block h2::before{ content:''; width:3mm; height:3mm; border-radius:50%; background:var(--gold); flex:none; }
  .block h3{ font-size:8.5pt; text-transform:uppercase; letter-spacing:.14em; color:var(--muted); margin:5mm 0 3mm; }
  .prose{ font-size:9.5pt; line-height:1.55; color:#33352f; }
  .prose.sub{ color:var(--muted); font-size:8.5pt; margin-bottom:3.5mm; }
  .lead{ font-size:10pt; margin-bottom:4mm; } .lead strong{ font-size:15pt; color:var(--mid-green); }
  .empty{ font-size:9pt; color:var(--muted); font-style:italic; }

  table.tbl{ width:100%; border-collapse:collapse; font-size:8.5pt; }
  .tbl th{ text-align:left; text-transform:uppercase; letter-spacing:.1em; font-size:6.5pt; font-weight:600; color:var(--muted); padding:0 3mm 2mm; border-bottom:1px solid var(--beige); }
  .tbl td{ padding:2.2mm 3mm; border-bottom:1px solid rgba(0,0,0,.05); vertical-align:top; }
  .tbl tr{ break-inside:avoid; }
  .tbl tr:last-child td{ border-bottom:none; }
  .t-type{ font-weight:600; color:var(--mid-green); } .t-ver{ color:var(--muted); font-variant-numeric:tabular-nums; }
  .t-date{ white-space:nowrap; font-variant-numeric:tabular-nums; } .t-num,.t-num td{ text-align:right; font-variant-numeric:tabular-nums; }
  .log .t-action{ font-weight:400; } .t-detail{ display:block; color:var(--muted); font-size:7.5pt; margin-top:.5mm; }

  .kv{ display:grid; grid-template-columns:repeat(2,1fr); gap:1mm 8mm; font-size:9pt; }
  .kv div{ display:flex; justify-content:space-between; align-items:center; padding:2mm 0; border-bottom:1px solid rgba(0,0,0,.05); }
  .kv span{ color:var(--muted); }

  .recs{ list-style:none; font-size:9.5pt; line-height:1.5; }
  .recs li{ padding:2.5mm 0 2.5mm 7mm; position:relative; border-bottom:1px solid rgba(0,0,0,.05); }
  .recs li::before{ content:''; position:absolute; left:0; top:4mm; width:3mm; height:3mm; border:1.5px solid var(--gold-warm); border-radius:50%; }

  /* Category tags in the activity log */
  .tag{ display:inline-block; padding:.6mm 2.4mm; border-radius:6mm; font-size:6.5pt; font-weight:600; letter-spacing:.04em; background:#eceae4; color:var(--ink); white-space:nowrap; }
  .c-update{ background:rgba(63,111,69,.14); color:var(--mid-green); }
  .c-security{ background:rgba(176,64,58,.12); color:#b0403a; }
  .c-backup{ background:rgba(184,154,90,.16); color:var(--copper); }
  .c-perf{ background:rgba(63,111,69,.1); color:#4a7a50; }
  .c-maint{ background:rgba(12,24,15,.08); color:var(--dark-green); }
  .c-monitor{ background:rgba(143,175,138,.22); color:#5a7a55; }
  .c-content{ background:rgba(196,168,84,.14); color:#8a7330; }

  .pill{ display:inline-block; padding:1mm 3mm; border-radius:8mm; font-size:7.5pt; font-weight:600; letter-spacing:.04em; background:#e7e7e3; color:var(--ink); }
  .pill.is-good{ background:rgba(63,111,69,.14); color:var(--mid-green); }
  .pill.is-warn{ background:rgba(184,154,90,.16); color:var(--copper); }
  .pill.is-bad{ background:rgba(176,64,58,.14); color:#b0403a; }
</style></head>
<body>
  <header class="head">
    <div class="brand">${LOGO_WHITE}</div>
    <div class="eyebrow">Onderhoudsrapport · ${esc(period.label)}</div>
    <h1>${esc(site.name)}<br><strong>onderhoud & beheer</strong></h1>
    <div class="meta-row">
      <div><span>Website</span><strong>${esc(site.url)}</strong></div>
      <div><span>Klant</span><strong>${esc(site.client ?? '—')}</strong></div>
      <div><span>Periode</span><strong>${fmtDate(period.from)} – ${fmtDate(period.to)}</strong></div>
    </div>
  </header>

  <main class="content">
    ${scorecard(site.summary)}
    ${summarySection(site.intro)}
    ${activitySection(site.activity)}
    ${updatesSection(site.updates)}
    ${securitySection(site.security)}
    ${backupsSection(site.backups)}
    ${uptimeSection(site.uptime)}
    ${performanceSection(site.performance)}
    ${analyticsSection(site.analytics)}
    ${healthSection(site.health)}
    ${recommendationsSection(site.recommendations)}
  </main>
</body></html>`;
}

module.exports = { renderReport };
