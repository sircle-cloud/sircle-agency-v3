/**
 * E2E tests for cross-page link integrity.
 * Verifies that all internal navigation links resolve to valid pages.
 */
import { test, expect } from '@playwright/test';

const pages = [
  { name: 'Homepage', path: '/' },
  { name: 'Diensten', path: '/diensten.html' },
  { name: 'Werk', path: '/werk.html' },
  { name: 'Over Ons', path: '/over-ons.html' },
  { name: 'Contact', path: '/contact.html' },
];

const caseStudies = [
  '/werk/casper-bouman.html',
  '/werk/vlijt-tandartsen.html',
  '/werk/kanslokaal.html',
  '/werk/dudok-consulting.html',
  '/werk/22qminded.html',
  '/werk/breinwijzers.html',
  '/werk/stoneborn.html',
];

test.describe('Cross-page link integrity', () => {
  for (const page of pages) {
    test(`${page.name} loads without errors`, async ({ page: p }) => {
      const response = await p.goto(page.path);
      expect(response.status()).toBe(200);
    });
  }

  for (const casePath of caseStudies) {
    const name = casePath.split('/').pop().replace('.html', '');
    test(`Case study "${name}" loads without errors`, async ({ page }) => {
      const response = await page.goto(casePath);
      expect(response.status()).toBe(200);
    });
  }

  test('all internal links on homepage point to valid pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const links = await page.locator('a[href]').evaluateAll(els =>
      els
        .map(el => el.getAttribute('href'))
        .filter(href =>
          href &&
          !href.startsWith('#') &&
          !href.startsWith('http') &&
          !href.startsWith('mailto:') &&
          !href.startsWith('tel:') &&
          !href.startsWith('javascript:')
        )
    );

    // Deduplicate
    const uniqueLinks = [...new Set(links)];

    for (const link of uniqueLinks) {
      const response = await page.goto(`/${link}`);
      expect(response.status(), `Broken link: ${link}`).toBe(200);
    }
  });

  test('all internal links on werk.html point to valid case study pages', async ({ page }) => {
    await page.goto('/werk.html');
    await page.waitForLoadState('networkidle');

    const links = await page.locator('a[href]').evaluateAll(els =>
      els
        .map(el => el.getAttribute('href'))
        .filter(href =>
          href &&
          !href.startsWith('#') &&
          !href.startsWith('http') &&
          !href.startsWith('mailto:') &&
          !href.startsWith('tel:') &&
          !href.startsWith('javascript:')
        )
    );

    const uniqueLinks = [...new Set(links)];

    for (const link of uniqueLinks) {
      const response = await page.goto(`/${link}`);
      expect(response.status(), `Broken link from werk.html: ${link}`).toBe(200);
    }
  });
});

test.describe('Page meta tags', () => {
  for (const p of pages) {
    test(`${p.name} has a <title> tag`, async ({ page }) => {
      await page.goto(p.path);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });
  }
});

test.describe('Image loading attributes', () => {
  test('images below the fold have loading="lazy"', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that at least some images use lazy loading
    const lazyImages = await page.locator('img[loading="lazy"]').count();
    expect(lazyImages).toBeGreaterThan(0);
  });
});
