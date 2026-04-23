#!/usr/bin/env node
/**
 * Attempt to capture screenshots from publicly-shared Figma design files.
 * Works ONLY if the file is shared with "Anyone with the link → can view".
 *
 * Usage: node tools/capture-figma-screenshots.js
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FIGMA_FILES = [
  {
    id: 'casper-bouman',
    label: 'Casper Bouman',
    url: 'https://www.figma.com/design/qMaIUwcSoizZ9n3sCR22Qg/Casper-Bouman?node-id=0-1&t=5diHet66nXXJJLaA-1',
  },
];

async function capture(browser, file, outDir) {
  console.log(`\n→ ${file.label}`);
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  let navigated = false;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await page.goto(file.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      navigated = true;
      break;
    } catch (err) {
      console.warn(`    ! attempt ${attempt}/4: ${err.message.split('\n')[0]}`);
      if (attempt < 4) await page.waitForTimeout(3000 * attempt);
    }
  }
  if (!navigated) {
    console.error(`    ✗ could not reach Figma — skipping`);
    await ctx.close();
    return false;
  }

  // Wait for Figma to load its canvas (this takes a while)
  await page.waitForTimeout(15000);

  // Check if we're at a login gate
  const hasLoginForm = await page.evaluate(() => {
    const text = document.body.innerText.toLowerCase();
    return text.includes('sign up') || text.includes('log in') || text.includes('continue with') ||
           !!document.querySelector('input[type="password"]');
  });

  if (hasLoginForm) {
    console.warn(`    ✗ login gate detected — file is not publicly shared`);
    await page.screenshot({
      path: path.join(outDir, `${file.id}-LOGIN-GATE.jpg`),
      type: 'jpeg',
      quality: 80,
    });
    await ctx.close();
    return false;
  }

  // Try to dismiss any onboarding overlays
  for (const sel of [
    'button:has-text("Got it")',
    'button:has-text("Skip")',
    'button:has-text("Close")',
    '[aria-label="Close"]',
    '[aria-label="Dismiss"]',
  ]) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 300 }).catch(() => false)) {
        await el.click();
        await page.waitForTimeout(500);
      }
    } catch {}
  }

  await page.waitForTimeout(3000);

  const outPath = path.join(outDir, `${file.id}-figma.jpg`);
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 85 });
  console.log(`    ✓ ${path.basename(outPath)} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);

  await ctx.close();
  return true;
}

async function main() {
  const outDir = path.resolve(__dirname, '../assets/cases/screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  for (const file of FIGMA_FILES) {
    await capture(browser, file, outDir);
  }
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
