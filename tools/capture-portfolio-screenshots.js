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
  },
  {
    id: '22qminded',
    label: '22qMinded',
    url: 'https://22qminded.com',
  },
  {
    id: 'casper-bouman',
    label: 'Casper Bouman',
    url: 'https://www.casperbouman.com',
  },
  {
    id: 'dudok',
    label: 'Dudok Consulting',
    url: 'https://dudokconsulting.nl',
  },
  {
    id: 'kanslokaal',
    label: 'Kanslokaal',
    url: 'https://kanslokaal.nl',
  },
];

// Cookie banner selectors — ordered from most specific to most generic.
// Tries each in turn; the first one that's visible gets clicked.
const COOKIE_DISMISS_SELECTORS = [
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
  '#onetrust-accept-btn-handler',
  '.cookie-accept',
  '.accept-cookies',
  '#cookie-accept',
  '[data-cookieconsent="accept"]',
  '[aria-label="Accept cookies"]',
  '.cc-btn.cc-allow',
  // Cookiebot-specific
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',
  // Generic fallback
  'a:has-text("Accepteer alle")',
  'a:has-text("Akkoord")',
];

async function dismissCookieBanner(page) {
  // Give the banner time to render
  await page.waitForTimeout(1500);

  for (const selector of COOKIE_DISMISS_SELECTORS) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
        await el.click({ timeout: 2000 });
        console.log(`    ↳ dismissed via: ${selector}`);
        // Wait for banner to animate out
        await page.waitForTimeout(800);
        return true;
      }
    } catch {
      // try next selector
    }
  }

  // Last-resort: try to find any element with "cookie" in class/id and hide it
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

async function captureSite(browser, site, outDir) {
  console.log(`\n→ ${site.label} (${site.url})`);

  // ---- Desktop hero + full page ----
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // retina quality
    locale: 'nl-NL',
    ignoreHTTPSErrors: true,
  });
  const desktopPage = await desktopCtx.newPage();

  try {
    await desktopPage.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Then try to wait for the network to settle, but don't block on it
    await desktopPage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  } catch (err) {
    console.warn(`    ! navigation issue, continuing: ${err.message}`);
  }

  await dismissCookieBanner(desktopPage);
  // Let animations settle
  await desktopPage.waitForTimeout(1500);

  // Hero shot
  const heroPath = path.join(outDir, `${site.id}-hero.jpg`);
  await desktopPage.screenshot({
    path: heroPath,
    type: 'jpeg',
    quality: 88,
  });
  console.log(`    ✓ hero: ${path.basename(heroPath)}`);

  // Full-page shot
  const fullPath = path.join(outDir, `${site.id}-full.jpg`);
  await desktopPage.screenshot({
    path: fullPath,
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  });
  const fullSize = (fs.statSync(fullPath).size / 1024).toFixed(0);
  console.log(`    ✓ full: ${path.basename(fullPath)} (${fullSize} KB)`);

  await desktopCtx.close();

  // ---- Mobile shot ----
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14
    deviceScaleFactor: 3,
    locale: 'nl-NL',
    ignoreHTTPSErrors: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const mobilePage = await mobileCtx.newPage();

  try {
    await mobilePage.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobilePage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  } catch {}

  await dismissCookieBanner(mobilePage);
  await mobilePage.waitForTimeout(1500);

  const mobilePath = path.join(outDir, `${site.id}-mobile.jpg`);
  await mobilePage.screenshot({
    path: mobilePath,
    type: 'jpeg',
    quality: 88,
  });
  console.log(`    ✓ mobile: ${path.basename(mobilePath)}`);

  await mobileCtx.close();
}

async function main() {
  const only = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];
  const outDir = path.resolve(__dirname, '../assets/cases/screenshots');
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
      await captureSite(browser, site, outDir);
    } catch (err) {
      console.error(`    ✗ failed: ${site.label} — ${err.message}`);
    }
  }

  await browser.close();
  console.log(`\nDone. Screenshots saved to ${path.relative(process.cwd(), outDir)}/`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
