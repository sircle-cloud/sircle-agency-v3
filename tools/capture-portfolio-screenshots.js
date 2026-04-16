#!/usr/bin/env node
/**
 * Captures clean, hi-res portfolio screenshots of live client websites.
 * Dismisses cookie banners before shooting so the portfolio snippets look polished.
 *
 * Usage:
 *   node tools/capture-portfolio-screenshots.js
 *   node tools/capture-portfolio-screenshots.js --only=vlijt
 *
 * Output: assets/cases/screenshots/{client}-{type}.jpg
 *   type = hero (1440x900), full (full-page), mobile (375x812)
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SITES = [
  {
    id: 'vlijt',
    label: 'VLIJT Tandartsen',
    url: 'https://vlijttandartsen.nl',
    // Case detail page expects vlijt-web-1.jpg through vlijt-web-6.jpg
    sections: 6,
  },
  {
    id: '22qminded',
    label: '22qMinded',
    url: 'https://22qminded.com',
    sections: 5,
  },
  {
    id: 'casper-bouman',
    label: 'Casper Bouman',
    url: 'https://www.casperbouman.com',
    // Case detail page uses casper-web-1.jpg through casper-web-6.jpg
    sections: 6,
    // The asset filenames use "casper-" prefix (not "casper-bouman-")
    assetPrefix: 'casper',
  },
  {
    id: 'dudok',
    label: 'Dudok Consulting',
    url: 'https://dudokconsulting.nl',
    sections: 5,
  },
  {
    id: 'kanslokaal',
    label: 'Kanslokaal',
    url: 'https://kanslokaal.nl',
    sections: 5,
  },
  {
    id: 'breinwijzers',
    label: 'Breinwijzers',
    url: 'https://breinwijzers.nl',
    sections: 5,
  },
];

// Cookie banner selectors — ordered from most specific to most generic.
const COOKIE_DISMISS_SELECTORS = [
  // Cookiebot-specific
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',
  // OneTrust
  '#onetrust-accept-btn-handler',
  // Common button text patterns (Dutch + English)
  'button:has-text("Accepteer alle")',
  'button:has-text("Alles accepteren")',
  'button:has-text("Accepteer")',
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Akkoord")',
  'button:has-text("Ik ga akkoord")',
  'button:has-text("Alle cookies")',
  'button:has-text("Accept")',
  'button:has-text("OK")',
  'button:has-text("Sluiten")',
  // Common class/id patterns
  '.cookie-accept',
  '.accept-cookies',
  '#cookie-accept',
  '[data-cookieconsent="accept"]',
  '[aria-label="Accept cookies"]',
  '.cc-btn.cc-allow',
  // Generic fallback
  'a:has-text("Accepteer alle")',
  'a:has-text("Akkoord")',
];

// Popup / newsletter / promo modal dismissal selectors.
// Used after cookie banners — these are "Nee bedankt", X icons, etc.
const POPUP_DISMISS_SELECTORS = [
  'button[aria-label="Close" i]',
  'button[aria-label="Sluiten" i]',
  'button[aria-label*="close" i]',
  'button[aria-label*="dismiss" i]',
  'button[title*="close" i]',
  'button[title*="sluiten" i]',
  '.modal-close',
  '.popup-close',
  '.close-modal',
  '.modal__close',
  '.close-button',
  '[class*="closeButton"]',
  '[class*="CloseButton"]',
  '[data-dismiss="modal"]',
  'button:has-text("Nee bedankt")',
  'button:has-text("Niet nu")',
  'button:has-text("Misschien later")',
  'button:has-text("No thanks")',
  'button:has-text("Maybe later")',
  'a:has-text("Nee bedankt")',
  // Generic close-X patterns
  'button:has-text("✕")',
  'button:has-text("✖")',
  'button:has-text("×")',
  // Common library patterns
  '.fancybox-close',
  '.fancybox-close-small',
  '.mfp-close',
  '.popmake-close',
  '.optinmonster-popup-close',
  '.elementor-popup-close',
  '.brz-popup-close',
];

async function dismissCookieBanner(page) {
  await page.waitForTimeout(1500);

  for (const selector of COOKIE_DISMISS_SELECTORS) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 400 }).catch(() => false)) {
        await el.click({ timeout: 2000 });
        console.log(`    ↳ cookie dismissed via: ${selector}`);
        await page.waitForTimeout(800);
        return true;
      }
    } catch {}
  }

  // Last-resort: hide any cookie/consent container by class/id name
  await page.evaluate(() => {
    const candidates = document.querySelectorAll(
      '[class*="cookie" i], [id*="cookie" i], [class*="consent" i], [id*="consent" i]'
    );
    candidates.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 50 && rect.height < window.innerHeight) {
        el.style.setProperty('display', 'none', 'important');
      }
    });
  });
  return false;
}

async function dismissPopups(page) {
  // Some popups appear after a delay (intent-to-leave, time-based). Wait a bit.
  await page.waitForTimeout(1500);

  let dismissed = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    let didClick = false;
    for (const selector of POPUP_DISMISS_SELECTORS) {
      try {
        const elements = page.locator(selector);
        const count = await elements.count();
        for (let i = 0; i < count; i++) {
          const el = elements.nth(i);
          if (await el.isVisible({ timeout: 200 }).catch(() => false)) {
            await el.click({ timeout: 2000, force: true }).catch(() => {});
            console.log(`    ↳ popup dismissed via: ${selector}`);
            dismissed++;
            didClick = true;
            await page.waitForTimeout(500);
            break;
          }
        }
        if (didClick) break;
      } catch {}
    }
    if (!didClick) break;
  }

  // Fallback: hide any element that looks like a fixed-position modal overlay
  await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      const rect = el.getBoundingClientRect();
      // Heuristic: large centered overlay covering >40% of viewport in both axes,
      // with high z-index, and not part of the navigation
      const coversBigChunk =
        rect.width > window.innerWidth * 0.4 &&
        rect.height > window.innerHeight * 0.4 &&
        rect.height < window.innerHeight * 0.95;
      const z = parseInt(cs.zIndex, 10) || 0;
      const className = (el.className && el.className.toString && el.className.toString().toLowerCase()) || '';
      const id = (el.id || '').toLowerCase();
      const isModalish =
        /modal|popup|overlay|dialog|lightbox|optin|newsletter|signup/.test(className + ' ' + id);
      if (coversBigChunk && (z > 100 || isModalish)) {
        el.style.setProperty('display', 'none', 'important');
      }
    }
    // Also remove any backdrop scrim
    document.querySelectorAll('[class*="backdrop" i], [class*="overlay" i]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.8) {
        el.style.setProperty('display', 'none', 'important');
      }
    });
  });

  return dismissed;
}

async function gotoWithRetry(page, url, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      return true;
    } catch (err) {
      lastErr = err;
      console.warn(`    ! attempt ${attempt}/${maxAttempts} failed: ${err.message.split('\n')[0]}`);
      if (attempt < maxAttempts) {
        await page.waitForTimeout(2000 * attempt); // exponential-ish backoff
      }
    }
  }
  throw lastErr;
}

async function prepareForScreenshot(page) {
  await dismissCookieBanner(page);
  await dismissPopups(page);
  // Scroll to top in case any earlier interaction shifted it
  await page.evaluate(() => window.scrollTo(0, 0));
  // Final wait so animations + lazy-loaded images settle
  await page.waitForTimeout(1500);
}

// Block known popup/marketing-modal providers entirely so they never appear.
// This is the most reliable way to handle iframe-based popups (Klaviyo, MailerLite,
// OptinMonster, Sumo, etc.) that don't respond to DOM dismiss attempts.
const BLOCKED_DOMAINS = [
  'klaviyo.com',
  'klaviyo.net',
  'mailerlite.com',
  'optinmonster.com',
  'sumo.com',
  'getsitecontrol.com',
  'mailmunch.com',
  'sleeknote.com',
  'wisepops.com',
  'privy.com',
  'omnisend.com',
  'getdrip.com',
  'hotjar.com', // also blocks recording overlays
  'intercom.io',
  'crisp.chat',
  'tawk.to',
];

async function blockPopupProviders(context) {
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (BLOCKED_DOMAINS.some(d => url.includes(d))) {
      await route.abort();
    } else {
      await route.continue();
    }
  });
}

// Inject CSS at the earliest possible moment so popups never appear, even if
// they're built into the page itself (not iframes). This runs before any
// page script, so popups are hidden the moment they render.
async function injectPopupBlockerCSS(context) {
  await context.addInitScript(() => {
    const css = `
      /* Hide common popup/modal/newsletter overlays */
      [class*="popup" i],
      [class*="Popup" i],
      [class*="modal" i]:not([class*="modal-content"]):not([class*="modal-body"]),
      [class*="newsletter" i]:not(footer [class*="newsletter" i]),
      [class*="signup" i]:not(footer [class*="signup" i]),
      [class*="optin" i],
      [class*="lightbox" i],
      [id*="popup" i],
      [id*="newsletter" i],
      [id*="optin" i],
      .pum-overlay,
      .pum-container,
      .popmake,
      .popmake-overlay,
      .elementor-popup-modal,
      .elementor-location-popup,
      .brz-popup2,
      .fancybox-container,
      .mfp-container,
      div[role="dialog"],
      div[aria-modal="true"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      /* Make sure body scroll isn't locked by popup scripts */
      html, body {
        overflow: auto !important;
        position: static !important;
      }
    `;
    const inject = () => {
      if (!document.documentElement) return;
      const style = document.createElement('style');
      style.id = '__popup_blocker__';
      style.textContent = css;
      document.documentElement.appendChild(style);
    };
    inject();
    // Also run after DOM is ready in case the early injection missed something
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    }
  });
}

// Take N viewport screenshots anchored on actual content sections of the page.
// Avoids the blank-padding-between-sections problem of pure scroll-based capture.
// Saves as {prefix}-web-1.jpg, {prefix}-web-2.jpg, etc. in the asset dir.
async function captureScrollSections(page, assetDir, prefix, count) {
  const viewportH = await page.evaluate(() => window.innerHeight);

  // Find content-rich anchor points: all h2s/h3s/sections that have substantial
  // text or images below them. We filter to only elements that are "anchors"
  // for visible content.
  const anchors = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll(
      'section, header, main > div, h1, h2, .hero, [class*="hero" i], [class*="section" i]'
    ));
    return candidates
      .map((el) => {
        const r = el.getBoundingClientRect();
        const textLen = (el.innerText || '').replace(/\s+/g, ' ').length;
        const imgCount = el.querySelectorAll('img').length;
        return {
          top: Math.round(r.top + window.scrollY),
          height: Math.round(r.height),
          tag: el.tagName.toLowerCase(),
          textLen,
          imgCount,
        };
      })
      .filter((a) => a.height > 300 && (a.textLen > 50 || a.imgCount > 0))
      .sort((a, b) => a.top - b.top);
  });

  const totalHeight = await page.evaluate(() => Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  ));
  console.log(`    page height=${totalHeight}, ${anchors.length} content anchors found`);

  // Pick N anchors that are roughly evenly spread across the page
  const picked = [];
  if (anchors.length >= count) {
    // Space them evenly through the anchor list
    for (let i = 0; i < count; i++) {
      const idx = Math.floor((anchors.length * i) / count);
      picked.push(anchors[idx]);
    }
  } else {
    // Not enough anchors — use what we have, then fill with linear positions
    picked.push(...anchors);
    const maxScroll = Math.max(0, totalHeight - viewportH);
    while (picked.length < count) {
      const idx = picked.length;
      picked.push({ top: Math.round((maxScroll * idx) / count), height: 0, tag: 'scroll' });
    }
  }

  // De-duplicate positions that are within 200px of each other
  const deduped = [];
  for (const p of picked) {
    if (!deduped.some((d) => Math.abs(d.top - p.top) < 200)) deduped.push(p);
  }
  // Pad if dedup left us short
  while (deduped.length < count) {
    const lastTop = deduped.length ? deduped[deduped.length - 1].top : 0;
    deduped.push({ top: Math.min(totalHeight - viewportH, lastTop + viewportH), height: 0, tag: 'pad' });
  }

  for (let i = 0; i < count; i++) {
    const anchor = deduped[i];
    // Scroll so the anchor is ~20% from the top of the viewport (looks more natural)
    const scrollY = Math.max(0, anchor.top - Math.round(viewportH * 0.05));
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrollY);
    await page.waitForTimeout(1100);

    const outPath = path.join(assetDir, `${prefix}-web-${i + 1}.jpg`);
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 86 });
    const sizeKB = +(fs.statSync(outPath).size / 1024).toFixed(0);

    // Retry if screenshot is suspiciously small (likely mostly blank).
    // Threshold raised to 120 KB — mostly-white blank frames compress to ~80-100 KB.
    if (sizeKB < 120) {
      console.log(`    ⚠  ${path.basename(outPath)} is only ${sizeKB} KB (likely blank), retrying…`);
      let bestSize = sizeKB;
      // Try a few offsets to find a content-rich frame
      for (const offset of [0.5, -0.4, 1.0, -0.8]) {
        const retryY = Math.max(0, Math.min(totalHeight - viewportH, scrollY + Math.round(viewportH * offset)));
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), retryY);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: outPath, type: 'jpeg', quality: 86 });
        const newSize = +(fs.statSync(outPath).size / 1024).toFixed(0);
        if (newSize > bestSize + 40) {
          bestSize = newSize;
          console.log(`    ✓ ${path.basename(outPath)} (retry offset=${offset}, ${newSize} KB)`);
          if (newSize >= 150) break;
        }
      }
      if (bestSize < 120) {
        console.log(`    ⚠  ${path.basename(outPath)} still only ${bestSize} KB — best frame we found`);
      }
    } else {
      console.log(`    ✓ ${path.basename(outPath)} (scrollY=${scrollY}, ${sizeKB} KB)`);
    }
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
}

async function captureSite(browser, site, outDir, assetDir) {
  console.log(`\n→ ${site.label} (${site.url})`);

  // ---- Desktop hero + full page ----
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: 'nl-NL',
    ignoreHTTPSErrors: true,
  });
  await blockPopupProviders(desktopCtx);
  await injectPopupBlockerCSS(desktopCtx);
  const desktopPage = await desktopCtx.newPage();

  try {
    await gotoWithRetry(desktopPage, site.url);
  } catch (err) {
    console.error(`    ✗ desktop navigation gave up: ${err.message.split('\n')[0]}`);
    await desktopCtx.close();
    return;
  }

  await prepareForScreenshot(desktopPage);

  const heroPath = path.join(outDir, `${site.id}-hero.jpg`);
  await desktopPage.screenshot({ path: heroPath, type: 'jpeg', quality: 88 });
  console.log(`    ✓ hero: ${path.basename(heroPath)} (${(fs.statSync(heroPath).size / 1024).toFixed(0)} KB)`);

  const fullPath = path.join(outDir, `${site.id}-full.jpg`);
  await desktopPage.screenshot({ path: fullPath, type: 'jpeg', quality: 85, fullPage: true });
  console.log(`    ✓ full: ${path.basename(fullPath)} (${(fs.statSync(fullPath).size / 1024).toFixed(0)} KB)`);

  // Scroll-based sections for case detail pages — saved directly into
  // assets/cases/ to replace the old dirty screenshots.
  if (site.sections && assetDir) {
    const prefix = site.assetPrefix || site.id;
    await captureScrollSections(desktopPage, assetDir, prefix, site.sections);
  }

  await desktopCtx.close();

  // ---- Mobile shot ----
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    locale: 'nl-NL',
    ignoreHTTPSErrors: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await blockPopupProviders(mobileCtx);
  await injectPopupBlockerCSS(mobileCtx);
  const mobilePage = await mobileCtx.newPage();

  try {
    await gotoWithRetry(mobilePage, site.url);
  } catch (err) {
    console.error(`    ✗ mobile navigation gave up: ${err.message.split('\n')[0]}`);
    await mobileCtx.close();
    return;
  }

  await prepareForScreenshot(mobilePage);

  const mobilePath = path.join(outDir, `${site.id}-mobile.jpg`);
  await mobilePage.screenshot({ path: mobilePath, type: 'jpeg', quality: 88 });
  console.log(`    ✓ mobile: ${path.basename(mobilePath)} (${(fs.statSync(mobilePath).size / 1024).toFixed(0)} KB)`);

  await mobileCtx.close();
}

async function main() {
  const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];
  const outDir = path.resolve(__dirname, '../assets/cases/screenshots');
  const assetDir = path.resolve(__dirname, '../assets/cases'); // for -web-N.jpg files
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  const targets = only ? SITES.filter(s => s.id === only) : SITES;
  if (only && !targets.length) {
    console.error(`Unknown site id: ${only}`);
    console.error('Available:', SITES.map(s => s.id).join(', '));
    process.exit(1);
  }

  for (const site of targets) {
    try {
      await captureSite(browser, site, outDir, assetDir);
    } catch (err) {
      console.error(`    ✗ failed: ${site.label} — ${err.message}`);
    }
  }

  await browser.close();
  console.log(`\nDone. Screenshots saved to ${path.relative(process.cwd(), outDir)}/`);
  console.log(`Scroll sections saved to ${path.relative(process.cwd(), assetDir)}/`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
