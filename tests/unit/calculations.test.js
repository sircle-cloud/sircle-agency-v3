/**
 * Unit tests for position calculations, progress thresholds,
 * and other math-heavy logic extracted from the JS files.
 */
import { describe, it, expect } from 'vitest';

// ============================================
// Timeline step activation (diensten.js lines 18–26)
// ============================================
describe('Timeline step activation (diensten.js)', () => {
  /**
   * Extracted logic: a step at position i activates when
   * scrollProgress >= (i + 1) / totalSteps - 0.15
   */
  function getActiveSteps(scrollProgress, totalSteps) {
    const active = [];
    for (let i = 0; i < totalSteps; i++) {
      const stepProgress = (i + 1) / totalSteps;
      if (scrollProgress >= stepProgress - 0.15) {
        active.push(i);
      }
    }
    return active;
  }

  it('activates no steps at progress 0 with high threshold', () => {
    // 4 steps: thresholds at 0.10, 0.35, 0.60, 0.85
    expect(getActiveSteps(0, 4)).toEqual([]);
  });

  it('activates first step early due to -0.15 offset', () => {
    // First step threshold: (1/4) - 0.15 = 0.10
    expect(getActiveSteps(0.10, 4)).toEqual([0]);
  });

  it('activates all steps at progress 1.0', () => {
    expect(getActiveSteps(1.0, 4)).toEqual([0, 1, 2, 3]);
  });

  it('activates steps progressively', () => {
    // 4 steps: thresholds at 0.10, 0.35, 0.60, 0.85
    expect(getActiveSteps(0.05, 4)).toEqual([]);
    expect(getActiveSteps(0.20, 4)).toEqual([0]);
    expect(getActiveSteps(0.40, 4)).toEqual([0, 1]);
    expect(getActiveSteps(0.65, 4)).toEqual([0, 1, 2]);
    expect(getActiveSteps(0.90, 4)).toEqual([0, 1, 2, 3]);
  });

  it('works with a different number of steps', () => {
    // 3 steps: thresholds at 0.183, 0.517, 0.85
    expect(getActiveSteps(0.5, 3)).toEqual([0]);
    expect(getActiveSteps(0.55, 3)).toEqual([0, 1]);
  });
});

// ============================================
// SIRCLE Experience phase index from scroll progress
// (main.js line 348)
// ============================================
describe('SIRCLE Experience phase calculation (main.js)', () => {
  /**
   * Extracted: Math.min(Math.floor(progress * totalPhases), totalPhases - 1)
   */
  function getPhaseIndex(progress, totalPhases) {
    return Math.min(Math.floor(progress * totalPhases), totalPhases - 1);
  }

  it('returns phase 0 at the start', () => {
    expect(getPhaseIndex(0, 4)).toBe(0);
  });

  it('returns last phase at progress 1.0', () => {
    expect(getPhaseIndex(1.0, 4)).toBe(3);
  });

  it('clamps to max phase index', () => {
    expect(getPhaseIndex(1.5, 4)).toBe(3);
  });

  it('transitions at correct boundaries', () => {
    // With 4 phases, each phase covers 0.25 of progress
    expect(getPhaseIndex(0.0, 4)).toBe(0);
    expect(getPhaseIndex(0.24, 4)).toBe(0);
    expect(getPhaseIndex(0.25, 4)).toBe(1);
    expect(getPhaseIndex(0.49, 4)).toBe(1);
    expect(getPhaseIndex(0.50, 4)).toBe(2);
    expect(getPhaseIndex(0.74, 4)).toBe(2);
    expect(getPhaseIndex(0.75, 4)).toBe(3);
    expect(getPhaseIndex(0.99, 4)).toBe(3);
  });
});

// ============================================
// SIRCLE Experience progress bar Y position
// (main.js line 308)
// ============================================
describe('SIRCLE Experience progress bar position (main.js)', () => {
  /**
   * Extracted: y = (index / (totalPhases - 1)) * 150
   */
  function getProgressY(index, totalPhases) {
    return (index / (totalPhases - 1)) * 150;
  }

  it('returns 0 for the first phase', () => {
    expect(getProgressY(0, 4)).toBe(0);
  });

  it('returns 150 for the last phase', () => {
    expect(getProgressY(3, 4)).toBe(150);
  });

  it('returns 50 for the middle of 4 phases', () => {
    expect(getProgressY(1, 4)).toBe(50);
  });

  it('returns evenly spaced values', () => {
    expect(getProgressY(0, 4)).toBe(0);
    expect(getProgressY(1, 4)).toBe(50);
    expect(getProgressY(2, 4)).toBe(100);
    expect(getProgressY(3, 4)).toBe(150);
  });
});

// ============================================
// Magnetic button offset calculation
// (contact.js lines 134–135, over-ons.js lines 128–129)
// ============================================
describe('Magnetic button position calculation', () => {
  /**
   * Extracted: offset = (clientPos - rectEdge - dimension / 2) * multiplier
   */
  function getMagneticOffset(clientPos, rectStart, dimension, multiplier) {
    return (clientPos - rectStart - dimension / 2) * multiplier;
  }

  it('returns 0 when mouse is at center', () => {
    // rect.left=100, width=200, clientX=200 (center)
    expect(getMagneticOffset(200, 100, 200, 0.15)).toBe(0);
  });

  it('returns positive offset when mouse is right of center', () => {
    // rect.left=100, width=200, clientX=250 (50px right of center)
    expect(getMagneticOffset(250, 100, 200, 0.15)).toBeCloseTo(7.5);
  });

  it('returns negative offset when mouse is left of center', () => {
    // rect.left=100, width=200, clientX=150 (50px left of center)
    expect(getMagneticOffset(150, 100, 200, 0.15)).toBeCloseTo(-7.5);
  });

  it('scales with multiplier (0.15 for contact submit, 0.2 for CTA)', () => {
    const pos = 250, start = 100, dim = 200;
    expect(getMagneticOffset(pos, start, dim, 0.15)).toBeCloseTo(7.5);
    expect(getMagneticOffset(pos, start, dim, 0.20)).toBeCloseTo(10.0);
    expect(getMagneticOffset(pos, start, dim, 0.25)).toBeCloseTo(12.5);
  });
});

// ============================================
// 3D tilt calculations for pain cards
// (main.js lines 593–594)
// ============================================
describe('Pain card 3D tilt calculation (main.js)', () => {
  /**
   * Extracted:
   *   x = (clientX - rect.left) / rect.width - 0.5
   *   y = (clientY - rect.top) / rect.height - 0.5
   *   rotateY = x * 12, rotateX = -y * 8
   */
  function getTiltValues(clientX, clientY, rect) {
    const x = (clientX - rect.left) / rect.width - 0.5;
    const y = (clientY - rect.top) / rect.height - 0.5;
    return {
      rotateY: x * 12,
      rotateX: -y * 8,
      shadowX: -x * 20,
      shadowY: -y * 20,
    };
  }

  it('returns zero rotation at center of element', () => {
    const rect = { left: 0, top: 0, width: 200, height: 200 };
    const tilt = getTiltValues(100, 100, rect);
    expect(tilt.rotateY).toBeCloseTo(0);
    expect(tilt.rotateX).toBeCloseTo(0);
  });

  it('tilts right when mouse is on the right half', () => {
    const rect = { left: 0, top: 0, width: 200, height: 200 };
    const tilt = getTiltValues(200, 100, rect); // far right edge
    expect(tilt.rotateY).toBe(6); // 0.5 * 12
    expect(tilt.rotateX).toBeCloseTo(0);
  });

  it('tilts up when mouse is at top', () => {
    const rect = { left: 0, top: 0, width: 200, height: 200 };
    const tilt = getTiltValues(100, 0, rect); // top center
    expect(tilt.rotateY).toBeCloseTo(0);
    expect(tilt.rotateX).toBe(4); // -(-0.5) * 8
  });

  it('shadow offsets are opposite to tilt direction', () => {
    const rect = { left: 0, top: 0, width: 200, height: 200 };
    const tilt = getTiltValues(200, 0, rect); // top-right corner
    expect(tilt.shadowX).toBe(-10); // -(0.5) * 20
    expect(tilt.shadowY).toBe(10);  // -(-0.5) * 20
  });

  it('handles non-zero rect position', () => {
    const rect = { left: 100, top: 50, width: 200, height: 200 };
    const tilt = getTiltValues(200, 150, rect); // center of element
    expect(tilt.rotateY).toBeCloseTo(0);
    expect(tilt.rotateX).toBeCloseTo(0);
  });
});

// ============================================
// Testimonial carousel circular indexing
// (main.js lines 1589, 1607–1609)
// ============================================
describe('Carousel circular navigation (main.js)', () => {
  function nextSlide(current, total) {
    return (current + 1) % total;
  }

  function prevSlide(current, total) {
    return (current - 1 + total) % total;
  }

  it('wraps forward from last to first', () => {
    expect(nextSlide(4, 5)).toBe(0);
  });

  it('advances normally within range', () => {
    expect(nextSlide(2, 5)).toBe(3);
  });

  it('wraps backward from first to last', () => {
    expect(prevSlide(0, 5)).toBe(4);
  });

  it('goes back normally within range', () => {
    expect(prevSlide(3, 5)).toBe(2);
  });

  it('works with 2 items (toggle)', () => {
    expect(nextSlide(0, 2)).toBe(1);
    expect(nextSlide(1, 2)).toBe(0);
    expect(prevSlide(0, 2)).toBe(1);
    expect(prevSlide(1, 2)).toBe(0);
  });
});

// ============================================
// Swipe detection threshold
// (main.js lines 1604–1609)
// ============================================
describe('Swipe detection (main.js)', () => {
  /**
   * Extracted: triggers on |diff| > 50, diff = startX - endX
   * diff > 0 → swipe left (next), diff < 0 → swipe right (prev)
   */
  function detectSwipe(startX, endX) {
    const diff = startX - endX;
    if (Math.abs(diff) <= 50) return null;
    return diff > 0 ? 'next' : 'prev';
  }

  it('returns null for small movements', () => {
    expect(detectSwipe(100, 120)).toBeNull();
    expect(detectSwipe(100, 80)).toBeNull();
  });

  it('returns null at exactly 50px threshold', () => {
    expect(detectSwipe(100, 50)).toBeNull();
    expect(detectSwipe(100, 150)).toBeNull();
  });

  it('detects swipe left (next) for diff > 50', () => {
    expect(detectSwipe(200, 100)).toBe('next');
  });

  it('detects swipe right (prev) for diff < -50', () => {
    expect(detectSwipe(100, 200)).toBe('prev');
  });
});

// ============================================
// Navigation scroll behavior
// (main.js lines 152–180)
// ============================================
describe('Navigation scroll hide/show logic (main.js)', () => {
  /**
   * Extracted from main.js lines 152–180.
   * Simplified: evaluates whether nav should be hidden based on
   * current scroll position, last scroll position, and menu state.
   */
  function getNavState(currentY, lastScrollY, navHidden, menuOpen) {
    let scrolled = currentY > 40;
    let newHidden = navHidden;

    if (currentY <= 40) {
      return { scrolled: false, hidden: false };
    }

    if (!menuOpen && currentY > 200) {
      if (currentY > lastScrollY + 5 && !navHidden) {
        newHidden = true;
      } else if (currentY < lastScrollY - 5 && navHidden) {
        newHidden = false;
      }
    }

    return { scrolled, hidden: newHidden };
  }

  it('shows nav at top of page', () => {
    expect(getNavState(0, 0, false, false)).toEqual({ scrolled: false, hidden: false });
  });

  it('marks scrolled but does not hide when just past 40px', () => {
    expect(getNavState(100, 0, false, false)).toEqual({ scrolled: true, hidden: false });
  });

  it('hides nav when scrolling down past 200px', () => {
    expect(getNavState(210, 200, false, false)).toEqual({ scrolled: true, hidden: true });
  });

  it('shows nav when scrolling up', () => {
    // currentY must be > 200 for the hide/show logic to engage
    expect(getNavState(205, 215, true, false)).toEqual({ scrolled: true, hidden: false });
  });

  it('ignores small movements (< 5px deadzone)', () => {
    // Scrolling down by only 3px — within deadzone
    expect(getNavState(203, 200, false, false)).toEqual({ scrolled: true, hidden: false });
  });

  it('never hides when menu is open', () => {
    expect(getNavState(400, 200, false, true)).toEqual({ scrolled: true, hidden: false });
  });

  it('resets hidden state when returning to top', () => {
    expect(getNavState(30, 300, true, false)).toEqual({ scrolled: false, hidden: false });
  });
});

// ============================================
// Page transition link filtering
// (main.js lines 1704–1706)
// ============================================
describe('Page transition link detection (main.js)', () => {
  /**
   * Extracted from main.js line 1706: determines which links
   * should NOT be intercepted for page transitions.
   */
  function shouldIntercept(href, targetBlank) {
    if (!href) return false;
    if (href.startsWith('#')) return false;
    if (href.startsWith('http')) return false;
    if (href.startsWith('mailto:')) return false;
    if (href.startsWith('tel:')) return false;
    if (href.startsWith('javascript:')) return false;
    if (targetBlank) return false;
    return true;
  }

  it('intercepts relative page links', () => {
    expect(shouldIntercept('diensten.html', false)).toBe(true);
    expect(shouldIntercept('werk/casper-bouman.html', false)).toBe(true);
  });

  it('skips anchor links', () => {
    expect(shouldIntercept('#section', false)).toBe(false);
  });

  it('skips external URLs (http/https)', () => {
    expect(shouldIntercept('https://example.com', false)).toBe(false);
    expect(shouldIntercept('http://example.com', false)).toBe(false);
  });

  it('skips mailto links', () => {
    expect(shouldIntercept('mailto:info@sircle.agency', false)).toBe(false);
  });

  it('skips tel links', () => {
    expect(shouldIntercept('tel:+31612345678', false)).toBe(false);
  });

  it('skips javascript: links', () => {
    expect(shouldIntercept('javascript:void(0)', false)).toBe(false);
  });

  it('skips links with target="_blank"', () => {
    expect(shouldIntercept('diensten.html', true)).toBe(false);
  });

  it('skips empty/null href', () => {
    expect(shouldIntercept('', false)).toBe(false);
    expect(shouldIntercept(null, false)).toBe(false);
  });
});
