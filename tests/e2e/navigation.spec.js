/**
 * E2E tests for fullscreen navigation behavior.
 * Verifies menu open/close, keyboard navigation, and link clicks.
 */
import { test, expect } from '@playwright/test';

test.describe('Fullscreen navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page load and GSAP initialization
    await page.waitForLoadState('networkidle');
  });

  test('nav starts in not-active state', async ({ page }) => {
    const nav = page.locator('[data-navigation-status]');
    await expect(nav).toHaveAttribute('data-navigation-status', 'not-active');
  });

  test('hamburger click opens the menu', async ({ page }) => {
    const hamburger = page.locator('[data-navigation-toggle="toggle"]');
    const nav = page.locator('[data-navigation-status]');

    await hamburger.click();
    await expect(nav).toHaveAttribute('data-navigation-status', 'active');
  });

  test('hamburger click toggles menu closed', async ({ page }) => {
    const hamburger = page.locator('[data-navigation-toggle="toggle"]');
    const nav = page.locator('[data-navigation-status]');

    await hamburger.click();
    await expect(nav).toHaveAttribute('data-navigation-status', 'active');

    await hamburger.click();
    await expect(nav).toHaveAttribute('data-navigation-status', 'not-active');
  });

  test('Escape key closes the menu', async ({ page }) => {
    const hamburger = page.locator('[data-navigation-toggle="toggle"]');
    const nav = page.locator('[data-navigation-status]');

    await hamburger.click();
    await expect(nav).toHaveAttribute('data-navigation-status', 'active');

    await page.keyboard.press('Escape');
    await expect(nav).toHaveAttribute('data-navigation-status', 'not-active');
  });

  test('clicking a nav link closes the menu', async ({ page }) => {
    const hamburger = page.locator('[data-navigation-toggle="toggle"]');
    const nav = page.locator('[data-navigation-status]');

    await hamburger.click();
    await expect(nav).toHaveAttribute('data-navigation-status', 'active');

    // Click a close-toggle link (any nav link)
    const navLink = page.locator('.bold-nav__link[data-navigation-toggle="close"]').first();
    await navLink.click({ noWaitAfter: true });

    // The link triggers both close + page transition,
    // but the close attribute should fire immediately
    await expect(nav).toHaveAttribute('data-navigation-status', 'not-active');
  });
});

test.describe('Navigation scroll behavior', () => {
  test('nav gets .scrolled class after scrolling down', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('#nav');
    await expect(nav).not.toHaveClass(/scrolled/);

    // Scroll down past 40px threshold
    await page.evaluate(() => window.scrollTo(0, 100));
    await page.waitForTimeout(300);

    await expect(nav).toHaveClass(/scrolled/);
  });

  test('nav gets hidden when scrolling down past 200px', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('#nav');

    // Scroll down gradually to trigger hide
    await page.evaluate(() => window.scrollTo(0, 250));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);

    await expect(nav).toHaveClass(/nav-hidden/);
  });
});
