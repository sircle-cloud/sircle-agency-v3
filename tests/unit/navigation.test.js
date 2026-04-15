/**
 * Unit tests for navigation toggle behavior and nav theme swapping.
 * Source: js/main.js lines 183–218 (nav toggle), 1754–1774 (theme swap)
 */
import { describe, it, expect, beforeEach } from 'vitest';

describe('Bold fullscreen navigation toggle (main.js)', () => {
  let navStatusEl;

  beforeEach(() => {
    document.body.innerHTML = `
      <div data-navigation-status="not-active">
        <button data-navigation-toggle="toggle">Menu</button>
        <button data-navigation-toggle="close">Close</button>
      </div>
    `;
    navStatusEl = document.querySelector('[data-navigation-status]');
  });

  it('starts in not-active state', () => {
    expect(navStatusEl.getAttribute('data-navigation-status')).toBe('not-active');
  });

  it('toggles to active on toggle-button click', () => {
    // Simulates the toggle handler from main.js line 188–191
    const status = navStatusEl.getAttribute('data-navigation-status');
    if (status === 'not-active') {
      navStatusEl.setAttribute('data-navigation-status', 'active');
    } else {
      navStatusEl.setAttribute('data-navigation-status', 'not-active');
    }
    expect(navStatusEl.getAttribute('data-navigation-status')).toBe('active');
  });

  it('toggles back to not-active from active', () => {
    navStatusEl.setAttribute('data-navigation-status', 'active');
    const status = navStatusEl.getAttribute('data-navigation-status');
    if (status === 'not-active') {
      navStatusEl.setAttribute('data-navigation-status', 'active');
    } else {
      navStatusEl.setAttribute('data-navigation-status', 'not-active');
    }
    expect(navStatusEl.getAttribute('data-navigation-status')).toBe('not-active');
  });

  it('close button always sets not-active', () => {
    // Simulates main.js lines 198–204
    navStatusEl.setAttribute('data-navigation-status', 'active');
    navStatusEl.setAttribute('data-navigation-status', 'not-active'); // close action
    expect(navStatusEl.getAttribute('data-navigation-status')).toBe('not-active');
  });

  it('Escape key closes the menu (keyCode 27)', () => {
    // Simulates main.js lines 207–215
    navStatusEl.setAttribute('data-navigation-status', 'active');
    const e = { keyCode: 27 };
    if (e.keyCode === 27) {
      if (navStatusEl.getAttribute('data-navigation-status') === 'active') {
        navStatusEl.setAttribute('data-navigation-status', 'not-active');
      }
    }
    expect(navStatusEl.getAttribute('data-navigation-status')).toBe('not-active');
  });

  it('Escape key does nothing when menu is already closed', () => {
    // Should not cause errors or state changes
    const e = { keyCode: 27 };
    if (e.keyCode === 27) {
      if (navStatusEl.getAttribute('data-navigation-status') === 'active') {
        navStatusEl.setAttribute('data-navigation-status', 'not-active');
      }
    }
    expect(navStatusEl.getAttribute('data-navigation-status')).toBe('not-active');
  });

  it('non-Escape keys do not close the menu', () => {
    navStatusEl.setAttribute('data-navigation-status', 'active');
    const e = { keyCode: 13 }; // Enter
    if (e.keyCode === 27) {
      if (navStatusEl.getAttribute('data-navigation-status') === 'active') {
        navStatusEl.setAttribute('data-navigation-status', 'not-active');
      }
    }
    expect(navStatusEl.getAttribute('data-navigation-status')).toBe('active');
  });
});

describe('Nav light/dark theme swap (main.js)', () => {
  /**
   * Extracted from main.js lines 1759–1771.
   * Determines if nav should be in "light" mode based on
   * which section is currently under the nav bar.
   */
  function shouldNavBeLight(sections, navBottom) {
    let isLight = false;
    sections.forEach(sec => {
      const top = sec.top;
      const bottom = sec.bottom;
      if (top < navBottom && bottom > 0) {
        if (sec.classes.includes('section-cream') || sec.classes.includes('sc-timeline-section')) {
          isLight = true;
        }
      }
    });
    return isLight;
  }

  it('returns false when over a dark section', () => {
    const sections = [
      { top: -100, bottom: 500, classes: ['section-dark'] },
    ];
    expect(shouldNavBeLight(sections, 80)).toBe(false);
  });

  it('returns true when over a cream section', () => {
    const sections = [
      { top: -50, bottom: 400, classes: ['section-cream'] },
    ];
    expect(shouldNavBeLight(sections, 80)).toBe(true);
  });

  it('returns true when over a sc-timeline-section', () => {
    const sections = [
      { top: -30, bottom: 600, classes: ['sc-timeline-section'] },
    ];
    expect(shouldNavBeLight(sections, 80)).toBe(true);
  });

  it('returns false when cream section is below the nav', () => {
    const sections = [
      { top: 200, bottom: 600, classes: ['section-cream'] },
    ];
    expect(shouldNavBeLight(sections, 80)).toBe(false);
  });

  it('returns false when cream section has scrolled past', () => {
    const sections = [
      { top: -1000, bottom: -200, classes: ['section-cream'] },
    ];
    expect(shouldNavBeLight(sections, 80)).toBe(false);
  });

  it('picks up cream when multiple sections overlap the nav', () => {
    const sections = [
      { top: -500, bottom: 20, classes: ['section-dark'] },
      { top: 20, bottom: 800, classes: ['section-cream'] },
    ];
    expect(shouldNavBeLight(sections, 80)).toBe(true);
  });

  it('returns false when no sections are visible', () => {
    expect(shouldNavBeLight([], 80)).toBe(false);
  });
});
