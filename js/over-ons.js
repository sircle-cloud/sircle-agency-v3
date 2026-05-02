/* ============================================ */
/* OVER ONS (ABOUT) PAGE — JavaScript          */
/* ============================================ */

(function() {
  'use strict';

  // Skip entry-animaties met opacity:0 op mobile — gsap.from immediateRender
  // kan content invisible laten als ScrollTrigger niet vuurt (zelfde bug als
  // contact.html). Op mobile content gewoon altijd zichtbaar tonen.
  const isMobile = window.innerWidth < 768;

  // ---- HERO PARALLAX ----
  const heroImg = document.querySelector('.about-hero-img');
  if (heroImg) {
    gsap.to(heroImg, {
      yPercent: 25,
      ease: 'none',
      scrollTrigger: {
        trigger: '.about-hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5,
      }
    });
  }

  // Hero content fade on scroll
  const heroContent = document.querySelector('.about-hero-content');
  if (heroContent) {
    gsap.to(heroContent, {
      y: -60,
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '.about-hero',
        start: '50% top',
        end: 'bottom top',
        scrub: 0.5,
      }
    });
  }

  // ---- TIMELINE ANIMATION ----
  const timelineFill = document.querySelector('.timeline-line-fill');
  if (timelineFill) {
    ScrollTrigger.create({
      trigger: '.origin-timeline',
      start: 'top 85%',
      onEnter: () => {
        timelineFill.classList.add('animated');
      },
    });

    if (!isMobile) {
      gsap.from('.timeline-point', {
        y: 20,
        opacity: 0,
        stagger: 0.15,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.timeline-points',
          start: 'top 90%',
          toggleActions: 'play none none none',
        }
      });
    }
  }

  // ---- ORIGIN IMAGE PARALLAX ----
  const originImg = document.querySelector('.origin-image img');
  if (originImg && window.innerWidth > 1024) {
    gsap.to(originImg, {
      yPercent: -12,
      ease: 'none',
      scrollTrigger: {
        trigger: '.origin-image',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.5,
      }
    });
  }

  // ---- ECOSYSTEM CARDS HOVER ----
  const ecoCards = document.querySelectorAll('.ecosystem-card');
  ecoCards.forEach(card => {
    if (window.innerWidth > 767) {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--glow-x', `${x}px`);
        card.style.setProperty('--glow-y', `${y}px`);
      });
    }
  });

  // ---- VALUE CARDS HOVER GLOW ----
  const valueCards = document.querySelectorAll('.value-card--light');
  valueCards.forEach(card => {
    if (window.innerWidth > 767) {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--glow-x', `${x}px`);
        card.style.setProperty('--glow-y', `${y}px`);
      });
    }
  });

  // ---- TEAM PHOTO STRIP ENTRANCE ----
  const photoStrip = document.querySelector('.team-photo-strip');
  if (photoStrip && !isMobile) {
    gsap.from(photoStrip, {
      opacity: 0,
      y: 40,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: photoStrip,
        start: 'top 85%',
        toggleActions: 'play none none none',
      }
    });
  }

  // ---- CTA MAGNETIC HOVER ----
  const ctaBtn = document.querySelector('.final-cta .btn-primary');
  if (ctaBtn && window.innerWidth > 767) {
    ctaBtn.addEventListener('mousemove', (e) => {
      const rect = ctaBtn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(ctaBtn, {
        x: x * 0.2,
        y: y * 0.2,
        duration: 0.3,
        ease: 'power2.out',
      });
    });

    ctaBtn.addEventListener('mouseleave', () => {
      gsap.to(ctaBtn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1,0.5)' });
    });
  }

})();
