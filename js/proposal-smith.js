/* ============================================ */
/* SMITH × SIRCLE — Proposal page interactions  */
/* Timeline progress + hero chip entrance       */
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

  // ---- HERO CHIPS: staggered entrance after the title reveal ----
  const chips = document.querySelectorAll('.pp-hero-meta .chip');
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
