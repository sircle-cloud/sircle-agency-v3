// sircle.agency — Maintenance report template (HTML → PDF)
// Renders one branded A4 report per managed website, in the sircle house style
// (dark-green / gold / Kulim Park). Pure string template, no dependencies.

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

const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  if (!y || !m || !d) return esc(iso);
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
};

const statusClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('veilig') || s.includes('ok') || s.includes('gezond')) return 'is-good';
  if (s.includes('waarschuw') || s.includes('let op') || s.includes('warn')) return 'is-warn';
  if (s.includes('risico') || s.includes('kritiek') || s.includes('threat')) return 'is-bad';
  return 'is-neutral';
};

function scorecard(summary = {}) {
  const cards = [
    { label: 'Updates uitgevoerd', value: summary.updates ?? 0, unit: '' },
    { label: 'Backups gemaakt', value: summary.backups ?? 0, unit: '' },
    { label: 'Uptime', value: summary.uptimePct != null ? summary.uptimePct.toFixed(2) : '—', unit: '%' },
    { label: 'Security', value: esc(summary.security ?? '—'), unit: '', status: statusClass(summary.security) },
  ];
  return `<div class="scorecard">${cards
    .map(
      (c) => `<div class="score ${c.status || ''}">
        <div class="score-value">${c.value}<span class="score-unit">${c.unit}</span></div>
        <div class="score-label">${c.label}</div>
      </div>`
    )
    .join('')}</div>`;
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
  if (!rows.length) return section('Updates', `<p class="empty">Geen updates in deze periode.</p>`);
  return section(
    'Updates',
    `<table class="tbl"><thead><tr><th>Type</th><th>Naam</th><th>Versie</th><th>Datum</th></tr></thead><tbody>${rows.join(
      ''
    )}</tbody></table>`
  );
}

function backupsSection(backups = []) {
  if (!backups.length) return section('Backups', `<p class="empty">Geen backups geregistreerd.</p>`);
  const rows = backups
    .map(
      (b) =>
        `<tr><td class="t-date">${fmtDate(b.date)}</td><td>${esc(b.type)}</td><td>${esc(
          b.size ?? '—'
        )}</td><td><span class="pill ${statusClass(b.status)}">${esc(b.status ?? 'OK')}</span></td></tr>`
    )
    .join('');
  return section(
    'Backups',
    `<table class="tbl"><thead><tr><th>Datum</th><th>Type</th><th>Grootte</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`
  );
}

function uptimeSection(uptime = {}) {
  const incidents = uptime.incidents ?? [];
  const body = `<p class="lead"><strong>${
    uptime.pct != null ? uptime.pct.toFixed(2) : '—'
  }%</strong> beschikbaarheid in deze periode.</p>${
    incidents.length
      ? `<table class="tbl"><thead><tr><th>Start</th><th>Duur</th><th>Oorzaak</th></tr></thead><tbody>${incidents
          .map(
            (i) =>
              `<tr><td class="t-date">${fmtDate(i.start)}</td><td>${esc(i.duration ?? '—')}</td><td>${esc(
                i.note ?? '—'
              )}</td></tr>`
          )
          .join('')}</tbody></table>`
      : `<p class="empty">Geen downtime-incidenten geregistreerd.</p>`
  }`;
  return section('Uptime', body);
}

function securitySection(security = {}) {
  return section(
    'Security',
    `<div class="kv">
      <div><span>Status</span><strong class="pill ${statusClass(security.status)}">${esc(
      security.status ?? '—'
    )}</strong></div>
      <div><span>Scans uitgevoerd</span><strong>${esc(security.scans ?? 0)}</strong></div>
      <div><span>Bedreigingen gevonden</span><strong>${esc(security.threats ?? 0)}</strong></div>
      <div><span>Laatste scan</span><strong>${fmtDate(security.lastScan)}</strong></div>
    </div>`
  );
}

function performanceSection(perf) {
  if (!perf) return '';
  return section(
    'Performance',
    `<div class="kv">
      <div><span>PageSpeed mobiel</span><strong>${esc(perf.pageSpeedMobile ?? '—')}</strong></div>
      <div><span>PageSpeed desktop</span><strong>${esc(perf.pageSpeedDesktop ?? '—')}</strong></div>
      <div><span>Laatste meting</span><strong>${fmtDate(perf.lastCheck)}</strong></div>
    </div>`
  );
}

function section(title, inner) {
  return `<section class="block"><h2>${esc(title)}</h2>${inner}</section>`;
}

function renderReport(site, meta) {
  const period = meta.period ?? {};
  const agency = meta.agency ?? {};
  return `<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8">
<title>Maintenance report — ${esc(site.name)} — ${esc(period.label)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Kulim+Park:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --dark-green:#0C180F; --dark-green-deep:#060D08; --mid-green:#3F6F45; --sage:#8FAF8A;
    --gold:#F2E2A4; --gold-warm:#E8D590; --copper:#B89A5A; --cream:#F3EFE8; --warm-white:#FFF8EE;
    --ink:#1C1E1D; --muted:#6b6f6c;
  }
  *{box-sizing:border-box; margin:0; padding:0;}
  @page{ size:A4; margin:0; }
  html,body{ font-family:'Kulim Park','Helvetica Neue',Arial,sans-serif; color:var(--ink); background:var(--cream); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page{ width:210mm; min-height:297mm; background:var(--cream); position:relative; }

  /* ---- Cover header band ---- */
  .head{ background:var(--dark-green); color:var(--warm-white); padding:26mm 18mm 16mm; position:relative; overflow:hidden; }
  .head::after{ content:''; position:absolute; right:-40mm; top:-40mm; width:120mm; height:120mm; border-radius:50%; border:1px solid rgba(242,226,164,.14); }
  .head::before{ content:''; position:absolute; right:-18mm; bottom:-60mm; width:90mm; height:90mm; border-radius:50%; border:1px solid rgba(242,226,164,.10); }
  .brand{ width:44mm; margin-bottom:14mm; }
  .brand svg{ width:100%; height:auto; display:block; }
  .eyebrow{ text-transform:uppercase; letter-spacing:.32em; font-size:8pt; font-weight:600; color:var(--gold); margin-bottom:6mm; }
  .head h1{ font-weight:300; font-size:26pt; line-height:1.1; letter-spacing:-.01em; }
  .head h1 strong{ font-weight:700; color:var(--gold); }
  .meta-row{ display:flex; gap:14mm; margin-top:10mm; padding-top:6mm; border-top:1px solid rgba(242,226,164,.22); }
  .meta-row div span{ display:block; text-transform:uppercase; letter-spacing:.18em; font-size:6.5pt; color:var(--sage); margin-bottom:2mm; }
  .meta-row div strong{ font-weight:600; font-size:10pt; color:var(--warm-white); }

  /* ---- Scorecard ---- */
  .body{ padding:12mm 18mm 24mm; }
  .scorecard{ display:grid; grid-template-columns:repeat(4,1fr); gap:4mm; margin-top:-20mm; margin-bottom:12mm; position:relative; z-index:2; }
  .score{ background:var(--warm-white); border:1px solid var(--beige,#E9E2D6); border-top:2px solid var(--gold); border-radius:2mm; padding:6mm 5mm; box-shadow:0 4mm 14mm rgba(12,24,15,.08); }
  .score-value{ font-size:22pt; font-weight:700; color:var(--dark-green); line-height:1; }
  .score-unit{ font-size:11pt; font-weight:400; color:var(--muted); margin-left:1mm; }
  .score-label{ text-transform:uppercase; letter-spacing:.14em; font-size:6.5pt; font-weight:600; color:var(--muted); margin-top:3mm; }
  .score.is-good{ border-top-color:var(--mid-green); } .score.is-good .score-value{ color:var(--mid-green); }
  .score.is-warn{ border-top-color:var(--copper); } .score.is-warn .score-value{ color:var(--copper); }
  .score.is-bad{ border-top-color:#b0403a; } .score.is-bad .score-value{ color:#b0403a; }

  /* ---- Content blocks ---- */
  .block{ margin-bottom:9mm; break-inside:avoid; }
  .block h2{ font-weight:600; font-size:11pt; letter-spacing:.02em; color:var(--dark-green); padding-bottom:2.5mm; margin-bottom:4mm; border-bottom:1px solid var(--gold-warm); display:flex; align-items:center; gap:3mm; }
  .block h2::before{ content:''; width:3mm; height:3mm; border-radius:50%; background:var(--gold); }
  .lead{ font-size:10pt; margin-bottom:3mm; } .lead strong{ font-size:14pt; color:var(--mid-green); }
  .empty{ font-size:9pt; color:var(--muted); font-style:italic; }

  table.tbl{ width:100%; border-collapse:collapse; font-size:8.5pt; }
  .tbl th{ text-align:left; text-transform:uppercase; letter-spacing:.12em; font-size:6.5pt; font-weight:600; color:var(--muted); padding:0 3mm 2mm; border-bottom:1px solid var(--beige,#E9E2D6); }
  .tbl td{ padding:2.4mm 3mm; border-bottom:1px solid rgba(0,0,0,.05); vertical-align:top; }
  .tbl tr:last-child td{ border-bottom:none; }
  .t-type{ font-weight:600; color:var(--mid-green); } .t-ver{ color:var(--muted); font-variant-numeric:tabular-nums; } .t-date{ white-space:nowrap; font-variant-numeric:tabular-nums; }

  .kv{ display:grid; grid-template-columns:repeat(2,1fr); gap:3mm 8mm; font-size:9pt; }
  .kv div{ display:flex; justify-content:space-between; align-items:center; padding:2mm 0; border-bottom:1px solid rgba(0,0,0,.05); }
  .kv span{ color:var(--muted); }

  .pill{ display:inline-block; padding:1mm 3mm; border-radius:8mm; font-size:7.5pt; font-weight:600; letter-spacing:.04em; background:#e7e7e3; color:var(--ink); }
  .pill.is-good{ background:rgba(63,111,69,.14); color:var(--mid-green); }
  .pill.is-warn{ background:rgba(184,154,90,.16); color:var(--copper); }
  .pill.is-bad{ background:rgba(176,64,58,.14); color:#b0403a; }

  /* ---- Footer ---- */
  .foot{ position:absolute; left:18mm; right:18mm; bottom:10mm; display:flex; justify-content:space-between; align-items:center; padding-top:4mm; border-top:1px solid var(--gold-warm); font-size:7pt; color:var(--muted); text-transform:uppercase; letter-spacing:.14em; }
</style></head>
<body>
  <div class="page">
    <header class="head">
      <div class="brand">${LOGO_WHITE}</div>
      <div class="eyebrow">Maintenance Report · ${esc(period.label)}</div>
      <h1>${esc(site.name)}<br><strong>onderhoudsrapportage</strong></h1>
      <div class="meta-row">
        <div><span>Website</span><strong>${esc(site.url)}</strong></div>
        <div><span>Klant</span><strong>${esc(site.client ?? '—')}</strong></div>
        <div><span>Periode</span><strong>${fmtDate(period.from)} – ${fmtDate(period.to)}</strong></div>
      </div>
    </header>
    <main class="body">
      ${scorecard(site.summary)}
      ${updatesSection(site.updates)}
      ${backupsSection(site.backups)}
      ${uptimeSection(site.uptime)}
      ${securitySection(site.security)}
      ${performanceSection(site.performance)}
    </main>
    <footer class="foot">
      <span>${esc(agency.name ?? 'sircle.agency')} · ${esc(agency.location ?? 'Den Haag, NL')}</span>
      <span>${esc(agency.email ?? 'hello@sircle.agency')}</span>
    </footer>
  </div>
</body></html>`;
}

module.exports = { renderReport };
