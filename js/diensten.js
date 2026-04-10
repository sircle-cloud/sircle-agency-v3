/* ============================================ */
/* DIENSTEN PAGE — Animations & Interactions   */
/* ============================================ */

// --- Timeline progress line on scroll ---
const timelineLine = document.querySelector('.timeline-progress');
const timelineSteps = document.querySelectorAll('.timeline-step');

if (timelineLine) {
  ScrollTrigger.create({
    trigger: '.timeline',
    start: 'top 70%',
    end: 'bottom 50%',
    scrub: 0.3,
    onUpdate: (self) => {
      timelineLine.style.height = (self.progress * 100) + '%';

      // Activate steps based on progress
      timelineSteps.forEach((step, i) => {
        const stepProgress = (i + 1) / timelineSteps.length;
        if (self.progress >= stepProgress - 0.15) {
          step.classList.add('active');
        } else {
          step.classList.remove('active');
        }
      });
    }
  });
}

// --- Phase numbers are static (no counter animation) ---

// --- Sticky phase headers on scroll (subtle) ---
document.querySelectorAll('.phase-intro h2').forEach(h2 => {
  gsap.to(h2, {
    scrollTrigger: {
      trigger: h2.closest('.phase-section'),
      start: 'top 20%',
      end: 'bottom 50%',
      scrub: true,
    },
    opacity: 0.3,
    y: -20,
    ease: 'none',
  });
});

// --- Phase accent image parallax ---
document.querySelectorAll('.phase-accent-image .bg-texture').forEach(img => {
  gsap.to(img, {
    yPercent: 25,
    ease: 'none',
    scrollTrigger: {
      trigger: img.closest('.phase-section'),
      start: 'top bottom',
      end: 'bottom top',
      scrub: 0.5,
    }
  });
});

// --- Model nav smooth scroll ---
document.querySelectorAll('.model-nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(item.getAttribute('href'));
    if (target) {
      lenis.scrollTo(target, { offset: -80 });
    }
  });
});

// --- Phase case hover parallax on image ---
document.querySelectorAll('.phase-case').forEach(card => {
  const img = card.querySelector('img');
  if (img) {
    card.addEventListener('mouseenter', () => {
      gsap.to(img, { scale: 1.04, duration: 0.6, ease: 'power2.out' });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(img, { scale: 1, duration: 0.6, ease: 'power2.out' });
    });
  }
});
