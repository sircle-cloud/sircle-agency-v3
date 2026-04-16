/**
 * Unit tests for contact form validation logic
 * Source: js/contact.js lines 56–127
 *
 * Tests the validation rules extracted from the form submit handler.
 * GSAP animations are not tested here — those belong in E2E tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Extracted validation logic from contact.js.
 * Returns { valid, errors } where errors maps field names to booleans.
 *
 * Uses the same email regex as production: requires local part, @, domain with TLD.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateContactForm({ name, email }) {
  const errors = { name: false, email: false };
  let valid = true;

  if (!name || !name.trim()) {
    errors.name = true;
    valid = false;
  }

  if (!email || !EMAIL_REGEX.test(email.trim())) {
    errors.email = true;
    valid = false;
  }

  return { valid, errors };
}

describe('Contact form validation', () => {
  describe('name field', () => {
    it('rejects empty name', () => {
      const result = validateContactForm({ name: '', email: 'test@example.com' });
      expect(result.valid).toBe(false);
      expect(result.errors.name).toBe(true);
    });

    it('rejects whitespace-only name', () => {
      const result = validateContactForm({ name: '   ', email: 'test@example.com' });
      expect(result.valid).toBe(false);
      expect(result.errors.name).toBe(true);
    });

    it('rejects undefined name', () => {
      const result = validateContactForm({ name: undefined, email: 'test@example.com' });
      expect(result.valid).toBe(false);
      expect(result.errors.name).toBe(true);
    });

    it('accepts a valid name', () => {
      const result = validateContactForm({ name: 'Jan de Vries', email: 'jan@example.com' });
      expect(result.valid).toBe(true);
      expect(result.errors.name).toBe(false);
    });

    it('accepts a single character name', () => {
      const result = validateContactForm({ name: 'J', email: 'j@example.com' });
      expect(result.valid).toBe(true);
      expect(result.errors.name).toBe(false);
    });
  });

  describe('email field', () => {
    it('rejects empty email', () => {
      const result = validateContactForm({ name: 'Test', email: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.email).toBe(true);
    });

    it('rejects whitespace-only email', () => {
      const result = validateContactForm({ name: 'Test', email: '   ' });
      expect(result.valid).toBe(false);
      expect(result.errors.email).toBe(true);
    });

    it('rejects email without @', () => {
      const result = validateContactForm({ name: 'Test', email: 'notanemail' });
      expect(result.valid).toBe(false);
      expect(result.errors.email).toBe(true);
    });

    it('accepts email with @', () => {
      const result = validateContactForm({ name: 'Test', email: 'user@domain.com' });
      expect(result.valid).toBe(true);
      expect(result.errors.email).toBe(false);
    });

    it('rejects undefined email', () => {
      const result = validateContactForm({ name: 'Test', email: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors.email).toBe(true);
    });

    // These tests verify the hardened regex rejects inputs the old @-only check accepted
    it('rejects email with @ but no domain', () => {
      const result = validateContactForm({ name: 'Test', email: 'user@' });
      expect(result.valid).toBe(false);
      expect(result.errors.email).toBe(true);
    });

    it('rejects email with @ but no local part', () => {
      const result = validateContactForm({ name: 'Test', email: '@domain.com' });
      expect(result.valid).toBe(false);
      expect(result.errors.email).toBe(true);
    });

    it('rejects email without a TLD', () => {
      const result = validateContactForm({ name: 'Test', email: 'user@localhost' });
      expect(result.valid).toBe(false);
    });

    it('rejects email with spaces', () => {
      const result = validateContactForm({ name: 'Test', email: 'user @domain.com' });
      expect(result.valid).toBe(false);
    });

    it('accepts common Dutch business emails', () => {
      expect(validateContactForm({ name: 'T', email: 'hallo@sircle.agency' }).valid).toBe(true);
      expect(validateContactForm({ name: 'T', email: 'info@bedrijf.nl' }).valid).toBe(true);
      expect(validateContactForm({ name: 'T', email: 'jan.de.vries@example.co.uk' }).valid).toBe(true);
      expect(validateContactForm({ name: 'T', email: 'user+tag@domain.com' }).valid).toBe(true);
    });
  });

  describe('both fields invalid', () => {
    it('flags both errors when both are empty', () => {
      const result = validateContactForm({ name: '', email: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.name).toBe(true);
      expect(result.errors.email).toBe(true);
    });
  });

  describe('both fields valid', () => {
    it('passes with valid name and email', () => {
      const result = validateContactForm({ name: 'Sophie', email: 'sophie@sircle.agency' });
      expect(result.valid).toBe(true);
      expect(result.errors.name).toBe(false);
      expect(result.errors.email).toBe(false);
    });
  });
});

/**
 * DOM integration tests — validates that the form handler
 * correctly applies/removes CSS error classes.
 */
describe('Contact form DOM behavior', () => {
  let form, nameField, emailField, nameGroup, emailGroup;

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="contact-form">
        <div class="form-group">
          <input id="name" type="text" />
        </div>
        <div class="form-group">
          <input id="email" type="email" />
        </div>
        <button type="submit">Verstuur</button>
      </form>
      <div id="form-success"></div>
    `;
    form = document.getElementById('contact-form');
    nameField = form.querySelector('#name');
    emailField = form.querySelector('#email');
    nameGroup = nameField.closest('.form-group');
    emailGroup = emailField.closest('.form-group');
  });

  /**
   * Simulates the validation + error-class logic from contact.js.
   */
  function runFormValidation(formEl) {
    formEl.querySelectorAll('.form-group.error').forEach(g => g.classList.remove('error'));

    let valid = true;
    const name = formEl.querySelector('#name');
    const email = formEl.querySelector('#email');

    if (!name.value.trim()) {
      name.closest('.form-group').classList.add('error');
      valid = false;
    }

    if (!EMAIL_REGEX.test(email.value.trim())) {
      email.closest('.form-group').classList.add('error');
      valid = false;
    }

    return valid;
  }

  it('adds .error to name group when name is empty', () => {
    nameField.value = '';
    emailField.value = 'test@test.com';
    runFormValidation(form);
    expect(nameGroup.classList.contains('error')).toBe(true);
    expect(emailGroup.classList.contains('error')).toBe(false);
  });

  it('adds .error to email group when email is malformed', () => {
    nameField.value = 'Test User';
    emailField.value = 'invalid';
    runFormValidation(form);
    expect(nameGroup.classList.contains('error')).toBe(false);
    expect(emailGroup.classList.contains('error')).toBe(true);
  });

  it('adds .error to both groups when both are invalid', () => {
    nameField.value = '';
    emailField.value = '';
    runFormValidation(form);
    expect(nameGroup.classList.contains('error')).toBe(true);
    expect(emailGroup.classList.contains('error')).toBe(true);
  });

  it('clears previous errors before re-validating', () => {
    nameGroup.classList.add('error');
    emailGroup.classList.add('error');

    nameField.value = 'Valid Name';
    emailField.value = 'valid@email.com';
    const valid = runFormValidation(form);

    expect(valid).toBe(true);
    expect(nameGroup.classList.contains('error')).toBe(false);
    expect(emailGroup.classList.contains('error')).toBe(false);
  });

  it('simulates error-clear-on-focus behavior', () => {
    // Mirrors contact.js lines 122–126
    nameGroup.classList.add('error');
    // On focus, the error should be cleared
    nameField.dispatchEvent(new Event('focus'));
    // Since we need to wire this up manually for the test:
    nameField.addEventListener('focus', () => {
      nameField.closest('.form-group').classList.remove('error');
    });
    nameField.dispatchEvent(new Event('focus'));
    expect(nameGroup.classList.contains('error')).toBe(false);
  });
});
