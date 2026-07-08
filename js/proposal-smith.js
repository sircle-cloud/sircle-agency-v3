/* ============================================ */
/* SMITH × SIRCLE — Proposal page interactions  */
/* Timeline progress + route card entrance      */
/* ============================================ */

(function () {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  // ---- TIMELINE: progress line draws while scrolling, dots light up ----
  const timeline = document.querySelector('.timeline');
  const progress = document.querySelector('.timeline__progress');
  if (timeline && progress) {
    gsap.to(progress, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: timeline,
        start: 'top 70%',
        end: 'bottom 55%',
        scrub: 0.6
      }
    });

    document.querySelectorAll('.tl-item').forEach(item => {
      ScrollTrigger.create({
        trigger: item,
        start: 'top 68%',
        onEnter: () => item.classList.add('is-active'),
        onLeaveBack: () => item.classList.remove('is-active')
      });
    });
  }

  // ---- ROUTES: featured card gets a subtle gold glow pulse on arrival ----
  const featured = document.querySelector('.route-card--featured');
  if (featured) {
    gsap.fromTo(featured,
      { boxShadow: '0 0 0 rgba(242,226,164,0)' },
      {
        boxShadow: '0 12px 56px rgba(242,226,164,0.14)',
        duration: 1.2,
        ease: 'power2.out',
        scrollTrigger: { trigger: featured, start: 'top 75%' }
      }
    );
  }

  // ---- HERO CHIPS: staggered entrance after the title reveal ----
  const chips = document.querySelectorAll('.pp-chip');
  if (chips.length) {
    gsap.from(chips, {
      y: 16,
      opacity: 0,
      duration: 0.8,
      stagger: 0.1,
      delay: 1.4,
      ease: 'power3.out'
    });
  }
})();
