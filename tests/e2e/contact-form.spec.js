/**
 * E2E tests for the contact form on contact.html.
 * Verifies validation errors, error clearing, and success flow.
 */
import { test, expect } from '@playwright/test';

test.describe('Contact form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact.html');
    await page.waitForLoadState('networkidle');
  });

  test('form is visible on page load', async ({ page }) => {
    const form = page.locator('#contact-form');
    await expect(form).toBeVisible();
  });

  test('submitting empty form shows error on name and email', async ({ page }) => {
    // Submit with empty fields
    await page.locator('#contact-form button[type="submit"], #contact-form .form-submit').click();

    // Both name and email groups should get .error class
    const nameGroup = page.locator('#name').locator('..');
    const emailGroup = page.locator('#email').locator('..');

    await expect(nameGroup).toHaveClass(/error/);
    await expect(emailGroup).toHaveClass(/error/);
  });

  test('submitting with name but no email shows error only on email', async ({ page }) => {
    await page.fill('#name', 'Jan de Vries');
    await page.locator('#contact-form button[type="submit"], #contact-form .form-submit').click();

    const nameGroup = page.locator('#name').locator('..');
    const emailGroup = page.locator('#email').locator('..');

    await expect(nameGroup).not.toHaveClass(/error/);
    await expect(emailGroup).toHaveClass(/error/);
  });

  test('submitting with email lacking @ shows error on email', async ({ page }) => {
    await page.fill('#name', 'Jan de Vries');
    await page.fill('#email', 'notanemail');
    await page.locator('#contact-form button[type="submit"], #contact-form .form-submit').click();

    const emailGroup = page.locator('#email').locator('..');
    await expect(emailGroup).toHaveClass(/error/);
  });

  test('error clears on field focus', async ({ page }) => {
    // Trigger error first
    await page.locator('#contact-form button[type="submit"], #contact-form .form-submit').click();

    const nameGroup = page.locator('#name').locator('..');
    await expect(nameGroup).toHaveClass(/error/);

    // Focus the field
    await page.focus('#name');

    // Error should be cleared
    await expect(nameGroup).not.toHaveClass(/error/);
  });

  test('valid submission hides form and shows success message', async ({ page }) => {
    await page.fill('#name', 'Sophie Jansen');
    await page.fill('#email', 'sophie@sircle.agency');

    await page.locator('#contact-form button[type="submit"], #contact-form .form-submit').click();

    // Form should fade out (display none after animation)
    const form = page.locator('#contact-form');
    await expect(form).toBeHidden({ timeout: 2000 });

    // Success element should become visible
    const success = page.locator('#form-success');
    await expect(success).toHaveClass(/visible/, { timeout: 2000 });
  });
});
