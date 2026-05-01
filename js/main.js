/* ============================================ */
/* SIRCLE AGENCY — Main JavaScript             */
/* GSAP + ScrollTrigger + Lenis                */
/* Premium OSMO-Level Animations               */
/* ============================================ */

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// ---- UTILITY: CUSTOM SPLIT TEXT ----
// No external SplitText plugin needed
function splitTextIntoWords(el) {
  const text = el.textContent.trim();
  const words = text.split(/\s+/);
  el.innerHTML = '';
  el.setAttribute('aria-label', text);
  words.forEach((word, i) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.style.display = 'inline-block';
    span.style.overflow = 'hidden';
    const inner = document.createElement('span');
    inner.className = 'word-inner';
    inner.style.display = 'inline-block';
    inner.textContent = word;
    span.appendChild(inner);
    el.appendChild(span);
    if (i < words.length - 1) {
      el.appendChild(document.createTextNode(' '));
    }
  });
  return el.querySelectorAll('.word-inner');
}

function splitTextIntoChars(el) {
  const text = el.textContent.trim();
  el.innerHTML = '';
  el.setAttribute('aria-label', text);
  [...text].forEach(char => {
    const span = document.createElement('span');
    span.className = 'char';
    span.style.display = 'inline-block';
    span.textContent = char === ' ' ? '\u00A0' : char;
    el.appendChild(span);
  });
  return el.querySelectorAll('.char');
}

// ---- DETECT MOBILE + SAFARI ----
const isMobile = window.innerWidth < 768;
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
if (isSafari) document.body.classList.add('is-safari');

// ---- LENIS SMOOTH SCROLL ----
const lenis = window.lenis = new Lenis({
  duration: isSafari ? 0.6 : 1.0,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: !isSafari, // native scroll op Safari (smoother trackpad)
  wheelMultiplier: 1.0,
  touchMultiplier: 1.5,
  infinite: false,
  autoResize: true,
});

// Use GSAP ticker for Lenis (single RAF loop, no conflict)
gsap.ticker.add((time) => { lenis.raf(time * 1000); });
gsap.ticker.lagSmoothing(0);

// Sync scroll updates with ScrollTrigger
lenis.on('scroll', ScrollTrigger.update);

// ---- CUSTOM CURSOR ----
function initCustomCursor() {
  if (isMobile || isSafari) return; // Safari native cursor is beter — geen jank-fight

  const cursor = document.getElementById('cursor');
  if (!cursor) return;

  document.documentElement.classList.add('has-custom-cursor');

  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Smooth follow with GSAP ticker
  gsap.ticker.add(() => {
    cursorX += (mouseX - cursorX) * 0.15;
    cursorY += (mouseY - cursorY) * 0.15;
    gsap.set(cursor, { x: cursorX, y: cursorY });
  });

  // Hover states for interactive elements
  const hoverTargets = document.querySelectorAll('a:not(.case-card a), button, .btn-primary, .btn-secondary, .btn-ghost, input, textarea, .dot, .sircle-dot, .bold-nav__hamburger');
  hoverTargets.forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('is-hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
  });

  // "View" state for case cards
  const caseCards = document.querySelectorAll('.case-card');
  caseCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      cursor.classList.add('is-view');
    });
    card.addEventListener('mouseleave', () => {
      cursor.classList.remove('is-view');
    });
  });

  // Magnetic effect for primary buttons
  const magneticBtns = document.querySelectorAll('.btn-primary, .btn-secondary');
  magneticBtns.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(btn, {
        x: x * 0.25,
        y: y * 0.25,
        duration: 0.3,
        ease: 'power2.out',
      });
      cursor.classList.add('is-magnetic');
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, {
        x: 0,
        y: 0,
        duration: 0.6,
        ease: 'elastic.out(1, 0.4)',
      });
      cursor.classList.remove('is-magnetic');
    });
  });

  // Hide on leave window
  document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
  document.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'));
}
initCustomCursor();

// ---- INIT ON LOAD ----
window.addEventListener('load', () => {
  initAnimations();
});

// ---- NAVIGATION ----
const nav = document.getElementById('nav');

// Bold nav scroll state — hide on scroll down, show on scroll up (Red Panda pattern)
let lastScrollY = 0;
let navHidden = false;
window.addEventListener('scroll', () => {
  if (!nav) return;
  const currentY = window.scrollY;
  const navStatus = document.querySelector('[data-navigation-status]');
  const menuOpen = navStatus && navStatus.getAttribute('data-navigation-status') === 'active';

  if (currentY > 40) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
    nav.classList.remove('nav-hidden');
    navHidden = false;
  }

  // Only hide/show if menu is closed and past hero
  if (!menuOpen && currentY > 200) {
    if (currentY > lastScrollY + 5 && !navHidden) {
      nav.classList.add('nav-hidden');
      navHidden = true;
    } else if (currentY < lastScrollY - 5 && navHidden) {
      nav.classList.remove('nav-hidden');
      navHidden = false;
    }
  }
  lastScrollY = currentY;
});

// Bold fullscreen navigation toggle
function initBoldFullScreenNavigation() {
  document.querySelectorAll('[data-navigation-toggle="toggle"]').forEach(toggleBtn => {
    toggleBtn.addEventListener('click', () => {
      const navStatusEl = document.querySelector('[data-navigation-status]');
      if (!navStatusEl) return;
      if (navStatusEl.getAttribute('data-navigation-status') === 'not-active') {
        navStatusEl.setAttribute('data-navigation-status', 'active');
        if (typeof lenis !== 'undefined' && lenis) lenis.stop();
      } else {
        navStatusEl.setAttribute('data-navigation-status', 'not-active');
        if (typeof lenis !== 'undefined' && lenis) lenis.start();
      }
    });
  });

  document.querySelectorAll('[data-navigation-toggle="close"]').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
      const navStatusEl = document.querySelector('[data-navigation-status]');
      if (!navStatusEl) return;
      navStatusEl.setAttribute('data-navigation-status', 'not-active');
      if (typeof lenis !== 'undefined' && lenis) lenis.start();
    });
  });

  document.addEventListener('keydown', e => {
    if (e.keyCode === 27) {
      const navStatusEl = document.querySelector('[data-navigation-status]');
      if (!navStatusEl) return;
      if (navStatusEl.getAttribute('data-navigation-status') === 'active') {
        navStatusEl.setAttribute('data-navigation-status', 'not-active');
        if (typeof lenis !== 'undefined' && lenis) lenis.start();
      }
    }
  });
}
initBoldFullScreenNavigation();

// Legacy hamburger support (non-homepage pages)
const hamburger = document.getElementById('nav-hamburger');
const mobileMenu = document.getElementById('mobile-menu');
if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
    hamburger.classList.toggle('active');
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      hamburger.classList.remove('active');
    });
  });
}

// ---- SIRCLE EXPERIENCE — Fullscreen pinned scroll ----
function initSircleExperience() {
  const section = document.querySelector('.sircle-experience');
  if (!section) return;

  const phases = [...section.querySelectorAll('.sircle-exp__phase')];
  const images = [...section.querySelectorAll('.sircle-exp__model-img')];
  const dots = [...section.querySelectorAll('.sircle-exp__dot')];
  const progressFill = section.querySelector('.sircle-exp__progress-fill');
  const modelGlow = section.querySelector('.sircle-exp__model-glow');
  const bgEl = section.querySelector('.sircle-exp__bg');
  const totalPhases = phases.length;

  let currentPhase = -1;

  // Background gradients per phase — each has unique light direction
  const bgGradients = [
    'radial-gradient(ellipse 80% 70% at 15% 20%, rgba(143,175,138,0.28) 0%, transparent 80%), radial-gradient(ellipse 40% 40% at 85% 80%, rgba(143,175,138,0.06) 0%, transparent 60%), linear-gradient(155deg, #122E1C 0%, #0A1F12 30%, #040E07 60%, #071A0F 100%)',
    'radial-gradient(ellipse 75% 65% at 80% 20%, rgba(208,223,185,0.24) 0%, transparent 80%), radial-gradient(ellipse 45% 50% at 15% 75%, rgba(143,175,138,0.08) 0%, transparent 60%), linear-gradient(200deg, #122E1C 0%, #0A1F12 30%, #040E07 60%, #071A0F 100%)',
    'radial-gradient(ellipse 70% 55% at 40% 55%, rgba(242,226,164,0.16) 0%, transparent 75%), radial-gradient(ellipse 50% 50% at 75% 35%, rgba(196,168,84,0.10) 0%, transparent 60%), linear-gradient(145deg, #060F08 0%, #0D2818 25%, #1A3D24 50%, #071A0F 100%)',
    'radial-gradient(ellipse 90% 50% at 50% 95%, rgba(208,223,185,0.22) 0%, transparent 75%), radial-gradient(ellipse 60% 40% at 30% 85%, rgba(208,223,185,0.12) 0%, transparent 60%), linear-gradient(180deg, #040E08 0%, #071A0F 30%, #0D2818 60%, #1A3D24 100%)'
  ];

  function setPhase(index) {
    if (index === currentPhase) return;
    const prevPhase = currentPhase;
    currentPhase = index;

    // Hide ALL phases first, then show only the active one
    phases.forEach((p, i) => {
      p.classList.remove('is-active');
    });
    phases[index].classList.add('is-active');

    images.forEach((img, i) => img.classList.toggle('is-active', i === index));
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));

    // Animate in services with gold accent
    const services = phases[index].querySelectorAll('.sircle-exp__services li');
    gsap.fromTo(services, {
      x: 20,
      opacity: 0,
    }, {
      x: 0,
      opacity: 1,
      stagger: 0.08,
      duration: 0.4,
      ease: 'power3.out',
      delay: 0.1,
      overwrite: true
    });

    // Gold accent sweep + flash
    services.forEach((li, i) => {
      gsap.fromTo(li, { '--accent-width': '0%' }, {
        '--accent-width': '100%',
        duration: 0.5,
        delay: 0.2 + i * 0.08,
        ease: 'power2.out',
      });
      gsap.fromTo(li, { color: 'rgba(242,226,164,0.9)' }, {
        color: 'rgba(208,223,185,0.7)',
        duration: 0.6,
        delay: 0.2 + i * 0.08,
        ease: 'power2.out',
      });
    });

    // Animate progress bar
    if (progressFill) {
      gsap.to(progressFill, {
        y: (index / (totalPhases - 1)) * 150,
        duration: 0.5,
        ease: 'power2.out'
      });
    }

    // Shift background gradient
    if (bgEl) {
      gsap.to(bgEl, {
        opacity: 0.6,
        duration: 0.2,
        ease: 'power1.in',
        onComplete: () => {
          bgEl.style.background = bgGradients[index];
          gsap.to(bgEl, { opacity: 1, duration: 0.5, ease: 'power2.out' });
        }
      });
    }

    // Shift glow color per phase
    if (modelGlow) {
      const glowColors = [
        'radial-gradient(circle, rgba(143,175,138,0.18) 0%, transparent 65%)',
        'radial-gradient(circle, rgba(208,223,185,0.22) 0%, transparent 65%)',
        'radial-gradient(circle, rgba(242,226,164,0.18) 0%, transparent 65%)',
        'radial-gradient(circle, rgba(180,175,120,0.15) 0%, transparent 65%)'
      ];
      modelGlow.style.background = glowColors[index];
    }
  }

  // GSAP ScrollTrigger — pin and drive phases (desktop only)
  if (!isMobile) {
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      pin: '.sircle-exp__pin',
      pinSpacing: false,
      onUpdate: (self) => {
        const phaseIndex = Math.min(Math.floor(self.progress * totalPhases), totalPhases - 1);
        setPhase(phaseIndex);
      }
    });

    // Entry animation
    gsap.from('.sircle-exp__model', {
      scale: 0.7,
      opacity: 0,
      duration: 1.2,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 80%',
        end: 'top 20%',
        scrub: 1
      }
    });

    // Dot click navigation
    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        const sectionRect = section.getBoundingClientRect();
        const sectionTop = window.scrollY + sectionRect.top;
        const sectionHeight = section.offsetHeight;
        const targetScroll = sectionTop + (sectionHeight * (i / totalPhases)) + 10;
        lenis.scrollTo(targetScroll, { duration: 1.2 });
      });
    });

    // Set initial state
    setPhase(0);
  } else {
    // Mobile: stacked cards — each phase gets its own inline model image.
    // DOM manipulation is kept separate from GSAP so the layout still works
    // even if GSAP fails to load (slow connection, CDN outage, etc).
    phases.forEach((phase, i) => {
      phase.classList.add('is-active');

      // Inject a per-phase model image at the top of each phase card.
      // This replaces the broken single top-level model on mobile.
      if (images[i] && !phase.querySelector('.sircle-exp__phase-img')) {
        const mobileImg = images[i].cloneNode(true);
        mobileImg.classList.add('sircle-exp__phase-img');
        mobileImg.classList.remove('sircle-exp__model-img');
        mobileImg.removeAttribute('data-phase');
        phase.insertBefore(mobileImg, phase.firstChild);
      }
    });

    // GSAP reveal animation — wrapped in try/catch so failures don't break layout
    try {
      if (typeof gsap !== 'undefined' && gsap.from) {
        phases.forEach((phase) => {
          gsap.from(phase, {
            y: 40,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: phase,
              start: 'top 85%',
              toggleActions: 'play none none none',
            }
          });
        });
      }
    } catch (err) {
      console.warn('[sircle-experience] animation failed, layout still works:', err);
    }
  }
}
initSircleExperience();

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      lenis.scrollTo(target, { offset: -80 });
    }
  });
});

// ============================================
// MAIN ANIMATION INIT
// ============================================
function initAnimations() {

  // ============================================
  // 1. HERO — Split text per char, staggered reveal, parallax depth layers
  // ============================================
  const heroTl = gsap.timeline({ delay: 0.3 });

  // Split each .line into characters for staggered reveal
  const heroLines = document.querySelectorAll('.hero-title .line');
  const allHeroChars = [];

  const hasHeroLines = heroLines.length > 0;

  if (hasHeroLines && !isMobile) {
    heroLines.forEach(line => {
      const chars = splitTextIntoChars(line);
      allHeroChars.push(...chars);
    });

    // Set initial state (chars hidden, title container visible for layout)
    gsap.set('.hero-title', { opacity: 1 });
    gsap.set(allHeroChars, { y: '100%', opacity: 0 });

    heroTl
      .from('.bold-nav__logo', { y: -15, opacity: 0, duration: 0.8, ease: 'power2.out' })
      .from('.bold-nav__hamburger', { y: -15, opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.5')
      .fromTo('.hero-label', { y: 15, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.8, ease: 'power2.out',
      }, '-=0.3')
      .to(allHeroChars, {
        y: '0%',
        opacity: 1,
        stagger: 0.025,
        duration: 1.2,
        ease: 'power3.out',
      }, '-=0.5');
  } else if (hasHeroLines && isMobile) {
    // Mobile: simple line reveal
    gsap.set('.hero-title', { opacity: 1 });
    heroTl
      .from('.bold-nav__logo', { y: -20, opacity: 0, duration: 0.6, ease: 'power2.out' })
      .fromTo('.hero-label', { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, '-=0.2')
      .fromTo('.hero-title .line', { y: '100%', opacity: 0 }, {
        y: '0%', opacity: 1, stagger: 0.15, duration: 0.9, ease: 'power3.out'
      }, '-=0.3');
  }
  // No hero lines (case pages etc): nav stays fully visible, no animation

  // Hero subtitle reveal
  const heroSub = document.querySelector('.hero-sub');
  if (heroSub) {
    heroTl.fromTo(heroSub, { y: 15, opacity: 0, filter: 'blur(4px)' }, {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      duration: 1.0,
      ease: 'power2.out',
    }, '-=0.6');
  }

  heroTl
    .fromTo('.hero-cta', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out' }, '-=0.4')
    .fromTo('.scroll-indicator', { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out' }, '-=0.4');

  // ---- HERO: Ken Burns effect via GSAP (slow zoom + pan) ----
  if (!isMobile) {
    gsap.to('.hero-bg-video', {
      scale: 1.25,
      xPercent: -3,
      yPercent: -2,
      duration: 20,
      ease: 'none',
      repeat: -1,
      yoyo: true,
    });
  }

  // Hero parallax depth layers on scroll (foreground faster than background)
  gsap.to('.hero-bg-video', {
    yPercent: 35,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 0.3,
    }
  });

  // Hero content fades out with parallax (faster than bg for depth)
  gsap.to('.hero-content', {
    y: -150,
    opacity: 0,
    scale: 0.95,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: '40% top',
      end: '90% top',
      scrub: 0.3,
    }
  });

  // Scroll indicator fades first
  gsap.to('.scroll-indicator', {
    opacity: 0,
    y: -30,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: '10% top',
      end: '30% top',
      scrub: 0.3,
    }
  });

  // ---- HERO: Floating particles (CSS-only, performant) ----
  if (!isMobile) {
    const heroBg = document.querySelector('.hero-bg');
    if (heroBg) {
      const particleContainer = document.createElement('div');
      particleContainer.className = 'hero-particles';
      heroBg.appendChild(particleContainer);
      for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'hero-particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        p.style.animationDelay = (Math.random() * 8) + 's';
        p.style.animationDuration = (6 + Math.random() * 8) + 's';
        const size = 2 + Math.random() * 3;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.opacity = 0.15 + Math.random() * 0.3;
        particleContainer.appendChild(p);
      }
    }
  }

  // ============================================
  // 2. PAIN POINTS — Scroll-pinned sticky layout (OSMO style)
  // ============================================
  if (!isMobile) {
    const painSection = document.querySelector('.pain-points');
    const painCards = document.querySelectorAll('.pain-card');

    if (painSection && painCards.length) {
      // Add progress indicator
      const progressEl = document.createElement('div');
      progressEl.className = 'pain-progress';
      progressEl.innerHTML = '<div class="pain-progress-fill"></div>';
      painSection.appendChild(progressEl);

      // Staggered card entrance with scale + blur-to-sharp
      painCards.forEach((card, i) => {
        gsap.fromTo(card, {
          y: 80,
          opacity: 0,
          scale: 0.92,
          filter: 'blur(12px)',
        }, {
          y: 0,
          opacity: 1,
          scale: 1,
          filter: 'blur(0px)',
          duration: 1.0,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
          delay: i * 0.15,
        });

        // 3D tilt on hover (like mockup tilt)
        card.addEventListener('mousemove', (e) => {
          const rect = card.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          gsap.to(card, {
            rotateY: x * 12,
            rotateX: -y * 8,
            scale: 1.03,
            boxShadow: `${-x * 20}px ${-y * 20}px 50px rgba(7,25,12,0.15)`,
            duration: 0.4,
            ease: 'power2.out',
          });
        });
        card.addEventListener('mouseleave', () => {
          gsap.to(card, {
            rotateY: 0,
            rotateX: 0,
            scale: 1,
            boxShadow: '0 4px 32px rgba(7,25,12,0.06)',
            duration: 0.6,
            ease: 'elastic.out(1, 0.7)',
          });
        });
      });

      // Progress bar tracks scroll through section
      gsap.to('.pain-progress-fill', {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: painSection,
          start: 'top 80%',
          end: 'bottom 20%',
          scrub: true,
        }
      });

      // Pain icons clip-path morph animation
      const painIcons = document.querySelectorAll('.pain-icon');
      painIcons.forEach((icon) => {
        gsap.fromTo(icon, {
          clipPath: 'circle(0% at 50% 50%)',
          scale: 0.5,
        }, {
          clipPath: 'circle(100% at 50% 50%)',
          scale: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: icon,
            start: 'top 85%',
            toggleActions: 'play none none none',
          }
        });
      });
    }
  } else {
    // Mobile: simple reveal
    document.querySelectorAll('.pain-card').forEach((card, i) => {
      gsap.to(card, {
        y: 0, opacity: 1, duration: 0.6, delay: i * 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: card, start: 'top 88%', toggleActions: 'play none none none' }
      });
    });
  }

  // ============================================
  // REVEAL ANIMATIONS (generic .reveal-up / .reveal-clip)
  // ============================================
  document.querySelectorAll('.reveal-up').forEach(el => {
    const delay = parseFloat(el.dataset.delay) || 0;
    gsap.to(el, {
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      duration: 1.0,
      delay: delay,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 90%',
        toggleActions: 'play none none none',
      }
    });
  });

  // ============================================
  // SECTION TITLE — Smooth mask reveal
  // ============================================
  document.querySelectorAll('.section-title.reveal-up, .cta-title.reveal-up').forEach(title => {
    title.classList.remove('reveal-up');
    gsap.set(title, { opacity: 0, y: 30, filter: 'blur(6px)' });
    gsap.to(title, {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 1.2,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: title,
        start: 'top 88%',
        toggleActions: 'play none none none',
      }
    });
  });

  document.querySelectorAll('.reveal-clip').forEach(el => {
    const delay = parseFloat(el.dataset.delay) || 0;
    gsap.to(el, {
      clipPath: 'inset(0 0 0 0)',
      opacity: 1,
      duration: 0.6,
      delay: delay,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 95%',
        toggleActions: 'play none none none',
      }
    });
  });

  // ============================================
  // REVEAL-SCALE — Image zoom-out with clip reveal (cinema feel)
  // ============================================
  document.querySelectorAll('.reveal-scale').forEach(el => {
    const delay = parseFloat(el.dataset.delay) || 0;
    gsap.to(el, {
      opacity: 1,
      scale: 1,
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.4,
      delay: delay,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        toggleActions: 'play none none none',
      }
    });
  });

  // ============================================
  // REVEAL-SLIDE — Horizontal mask wipe from left
  // ============================================
  document.querySelectorAll('.reveal-slide').forEach(el => {
    const delay = parseFloat(el.dataset.delay) || 0;
    gsap.to(el, {
      opacity: 1,
      clipPath: 'inset(0 0% 0 0)',
      duration: 1.2,
      delay: delay,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        toggleActions: 'play none none none',
      }
    });
  });

  // ============================================
  // SCRUB-HIGHLIGHT — Word-by-word opacity scrub on scroll (Form&Fun / OSMO style)
  // ============================================
  document.querySelectorAll('.scrub-highlight').forEach(title => {
    const words = splitTextIntoWords(title);
    gsap.set(words, { opacity: 0.15 });
    words.forEach((word, i) => {
      gsap.to(word, {
        opacity: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: title,
          start: () => `top ${75 - i * 2.5}%`,
          end: () => `top ${65 - i * 2.5}%`,
          scrub: 0.5,
        }
      });
    });
  });

  // ============================================
  // Video container scale
  // ============================================
  gsap.from('.video-container', {
    scale: 0.92,
    borderRadius: '32px',
    duration: 1,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '.video-container',
      start: 'top 85%',
      toggleActions: 'play none none none',
    }
  });

  // ============================================
  // SIRCLE Model — Scroll-Driven Phase Rotation (OSMO-level)
  // ============================================
  if (!isMobile) {
    const sircleWrap = document.getElementById('sircle-scroll-wrap');
    const sircleCards = document.querySelectorAll('.sircle-service-card');
    const sirclePhaseImgs = document.querySelectorAll('.sircle-phase-img');
    const sircleGlow = document.getElementById('sircle-glow');
    const sircleProgressFill = document.getElementById('sircle-progress-fill');
    const sircleProgressDots = document.querySelectorAll('.sircle-progress-dot');
    const phases = ['intro', 'strategy', 'production', 'growth', 'care'];
    let currentPhase = 'intro';

    if (sircleWrap && sircleCards.length) {
      // Set initial state: intro image visible, glow subtle
      gsap.set(sircleGlow, { opacity: 0.4 });

      // Crossfade to a new phase with smooth GSAP transitions
      function setPhase(newPhase) {
        if (newPhase === currentPhase) return;
        const oldPhase = currentPhase;
        currentPhase = newPhase;

        // Crossfade phase images
        sirclePhaseImgs.forEach(img => {
          const imgPhase = img.dataset.phase;
          if (imgPhase === newPhase) {
            // Incoming: scale up slightly + fade in + subtle rotation
            gsap.to(img, {
              opacity: 1,
              scale: 1,
              rotate: 0,
              duration: 0.7,
              ease: 'power2.out',
              onStart: () => img.classList.add('active'),
            });
          } else if (imgPhase === oldPhase) {
            // Outgoing: scale down + fade out + slight counter-rotate
            gsap.to(img, {
              opacity: 0,
              scale: 0.92,
              rotate: -3,
              duration: 0.5,
              ease: 'power2.in',
              onComplete: () => img.classList.remove('active'),
            });
          }
        });

        // Glow pulse on phase switch
        gsap.timeline()
          .to(sircleGlow, { opacity: 0.8, scale: 1.2, duration: 0.3, ease: 'power2.out' })
          .to(sircleGlow, { opacity: 0.4, scale: 1, duration: 0.6, ease: 'power2.inOut' });

        // Update progress dots
        const phaseIndex = phases.indexOf(newPhase);
        sircleProgressDots.forEach((dot, i) => {
          if (i <= phaseIndex) {
            dot.classList.add('active');
          } else {
            dot.classList.remove('active');
          }
        });
      }

      // ScrollTrigger for each service card — detect which is in viewport center
      sircleCards.forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card,
          start: 'top 55%',
          end: 'bottom 45%',
          onEnter: () => {
            const phase = card.dataset.phase;
            setPhase(phase);
            // Activate card
            sircleCards.forEach(c => c.classList.remove('is-active'));
            card.classList.add('is-active');
          },
          onEnterBack: () => {
            const phase = card.dataset.phase;
            setPhase(phase);
            sircleCards.forEach(c => c.classList.remove('is-active'));
            card.classList.add('is-active');
          },
        });
      });

      // Reset to intro when scrolling back above first card
      ScrollTrigger.create({
        trigger: sircleCards[0],
        start: 'top 60%',
        onLeaveBack: () => {
          setPhase('intro');
          sircleCards.forEach(c => c.classList.remove('is-active'));
        },
      });

      // Progress bar fill based on overall scroll through section
      gsap.to(sircleProgressFill, {
        height: '100%',
        ease: 'none',
        scrollTrigger: {
          trigger: sircleWrap,
          start: 'top 60%',
          end: 'bottom 40%',
          scrub: 0.5,
        }
      });

      // Entrance animation for the model images area
      gsap.from('.sircle-model-images', {
        scale: 0.85,
        opacity: 0,
        duration: 1.0,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sircleWrap,
          start: 'top 75%',
          toggleActions: 'play none none none',
        }
      });

      // Card entrance stagger
      sircleCards.forEach((card, i) => {
        gsap.from(card, {
          y: 60,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 88%',
            toggleActions: 'play none none none',
          }
        });
      });
    }
  } else {
    // Mobile: simple reveal for model + cards, no scroll-driven phase switching
    const mobileModelImg = document.querySelector('.sircle-phase-img.active');
    if (mobileModelImg) {
      gsap.from(mobileModelImg, {
        scale: 0.85,
        opacity: 0,
        duration: 1.0,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.sircle-scroll-wrap',
          start: 'top 75%',
          toggleActions: 'play none none none',
        }
      });
    }
    document.querySelectorAll('.sircle-service-card').forEach((card, i) => {
      gsap.from(card, {
        y: 40,
        opacity: 0,
        duration: 0.7,
        delay: i * 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 88%',
          toggleActions: 'play none none none',
        }
      });
    });
  }

  
  // ============================================
  // SIRCLE MODEL — Simple scroll-triggered phase switching (no pin)
  // ============================================
  const sircleFullscreen = document.getElementById('sircle-fullscreen');
  
  if (sircleFullscreen && !isMobile) {
    const phases = ['intro', 'strategy', 'production', 'growth', 'care'];
    const phaseImgs = document.querySelectorAll('.sircle-phase-img');
    const infoPanels = document.querySelectorAll('.sircle-info-panel');
    const phaseDots = document.querySelectorAll('.sircle-dot');
    const glow = document.getElementById('sircle-glow');
    let currentPhaseIdx = 0;
    let autoPhaseInterval;
    
    function switchPhase(index) {
      if (index === currentPhaseIdx) return;
      const phase = phases[index];
      
      phaseImgs.forEach(img => {
        if (img.classList.contains('active')) {
          gsap.to(img, { opacity: 0, scale: 0.95, duration: 0.4, ease: 'power2.inOut', onComplete: () => img.classList.remove('active') });
        }
      });
      infoPanels.forEach(p => {
        if (p.classList.contains('active')) {
          gsap.to(p, { opacity: 0, y: -15, duration: 0.25, ease: 'power2.in', onComplete: () => p.classList.remove('active') });
        }
      });
      
      const newImg = document.querySelector(`.sircle-phase-img[data-phase="${phase}"]`);
      const newPanel = document.querySelector(`.sircle-info-panel[data-phase="${phase}"]`);
      if (newImg) {
        newImg.classList.add('active');
        gsap.fromTo(newImg, { opacity: 0, scale: 1.05 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' });
      }
      if (newPanel) {
        newPanel.classList.add('active');
        gsap.fromTo(newPanel, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', delay: 0.1 });
      }
      
      if (glow) {
        gsap.to(glow, { opacity: 0.4, scale: 1.1, duration: 0.25, ease: 'power2.out', 
          onComplete: () => gsap.to(glow, { opacity: 0.15, scale: 1, duration: 0.6, ease: 'power2.inOut' })
        });
      }
      
      phaseDots.forEach((d, i) => d.classList.toggle('active', i === index));
      currentPhaseIdx = index;
    }
    
    // Auto-cycle through phases when section is in view
    function startAutoCycle() {
      clearInterval(autoPhaseInterval);
      autoPhaseInterval = setInterval(() => {
        const nextIdx = (currentPhaseIdx + 1) % phases.length;
        switchPhase(nextIdx);
      }, 3000);
    }
    
    function stopAutoCycle() {
      clearInterval(autoPhaseInterval);
    }
    
    // Start auto-cycle when section enters viewport
    ScrollTrigger.create({
      trigger: sircleFullscreen,
      start: 'top 60%',
      end: 'bottom 20%',
      onEnter: startAutoCycle,
      onEnterBack: startAutoCycle,
      onLeave: stopAutoCycle,
      onLeaveBack: stopAutoCycle,
    });
    
    // Dot clicks
    phaseDots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        switchPhase(i);
        startAutoCycle(); // Restart timer
      });
    });
    
    // Entrance animation
    gsap.from(sircleFullscreen, {
      opacity: 0, y: 60, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: sircleFullscreen, start: 'top 80%', toggleActions: 'play none none none' }
    });
    
    // Initial glow
    gsap.to(glow, { opacity: 0.15, duration: 1, delay: 0.5 });
  }


  // ============================================
  // 3. CASES — Staggered reveal grid (no pin)
  // ============================================
  const casesGrid = document.querySelector('.cases-grid');
  
  if (casesGrid && !isMobile) {
    // Hover-effects alleen op desktop. iOS triggert mouseleave bij touch/scroll
    // wat een verticale "balkje"-animatie van .case-info veroorzaakte.
    const casesCards = casesGrid.querySelectorAll('.case-card');
    casesCards.forEach(card => {
      const img = card.querySelector('.case-image img');
      const info = card.querySelector('.case-info');

      card.addEventListener('mouseenter', () => {
        gsap.to(img, { scale: 1.06, duration: 0.6, ease: 'power2.out' });
        gsap.to(info, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
      });
      card.addEventListener('mouseleave', () => {
        gsap.to(img, { scale: 1, duration: 0.6, ease: 'power2.out' });
        gsap.to(info, { y: 6, opacity: 0.88, duration: 0.4, ease: 'power2.out' });
      });
    });
  }

  // ---- Marquee with scroll-velocity skew (Noco/Dapper pattern) ----
  const track = document.querySelector('.marquee-track');
  if (track) {
    track.innerHTML += track.innerHTML;

    // Scroll-velocity based skew + speed
    ScrollTrigger.create({
      trigger: '.marquee',
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const v = self.getVelocity();
        const skew = Math.min(Math.max(v / 300, -5), 5);
        gsap.to(track, {
          skewX: skew,
          duration: 0.3,
          ease: 'power2.out',
          overwrite: true,
        });
      }
    });
  }

  // ---- Scroll-velocity text skew for large titles ----
  if (!isMobile) {
    let currentSkew = 0;
    ScrollTrigger.create({
      trigger: 'body',
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const velocity = self.getVelocity();
        const targetSkew = Math.min(Math.max(velocity / 500, -3), 3);
        currentSkew += (targetSkew - currentSkew) * 0.1;
        gsap.set('.section-title, .cta-title, .quote-text', {
          skewX: currentSkew,
        });
      }
    });
  }

  // ============================================
  // 4. QUOTE — Text reveal per word (opacity + blur) on scroll
  // ============================================
  const quoteText = document.querySelector('.quote-text');
  if (quoteText && !isMobile) {
    // Split blockquote into words, handling <br> tags
    const html = quoteText.innerHTML;
    const parts = html.split(/<br\s*\/?>/gi);
    quoteText.innerHTML = '';

    parts.forEach((part, pi) => {
      const words = part.trim().split(/\s+/);
      words.forEach((word, wi) => {
        if (word) {
          const span = document.createElement('span');
          span.className = 'quote-word';
          span.textContent = word;
          quoteText.appendChild(span);
          if (wi < words.length - 1) {
            quoteText.appendChild(document.createTextNode('\u00A0'));
          }
        }
      });
      if (pi < parts.length - 1) {
        quoteText.appendChild(document.createElement('br'));
      }
    });

    const quoteWords = quoteText.querySelectorAll('.quote-word');
    gsap.set(quoteWords, { opacity: 0.1, filter: 'blur(8px)', textShadow: '0 0 0px rgba(212,185,120,0)' });

    // Word-by-word reveal with text-shadow glow on revealed words
    quoteWords.forEach((word, i) => {
      gsap.to(word, {
        opacity: 1,
        filter: 'blur(0px)',
        textShadow: '0 0 20px rgba(212,185,120,0.35), 0 0 40px rgba(212,185,120,0.15)',
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.quote-section',
          start: () => `top ${60 - i * 1.5}%`,
          end: () => `top ${52 - i * 1.5}%`,
          scrub: 0.5,
        }
      });
    });
  }

  // Deeper quote parallax background — multi-layer depth
  gsap.to('.quote-bg .bg-texture', {
    yPercent: 35,
    ease: 'none',
    scrollTrigger: {
      trigger: '.quote-section',
      start: 'top bottom',
      end: 'bottom top',
      scrub: 0.3,
    }
  });

  gsap.to('.quote-bg', {
    scale: 1.15,
    ease: 'none',
    scrollTrigger: {
      trigger: '.quote-section',
      start: 'top bottom',
      end: 'bottom top',
      scrub: 0.5,
    }
  });

  // Quote content counter-parallax for depth illusion
  const quoteContent = document.querySelector('.quote-content');
  if (quoteContent && !isMobile) {
    gsap.fromTo(quoteContent, {
      y: 60,
    }, {
      y: -40,
      ease: 'none',
      scrollTrigger: {
        trigger: '.quote-section',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
      }
    });
  }

  // ============================================
  // About image parallax
  // ============================================
  const aboutImg = document.querySelector('.about-image img');
  if (aboutImg) {
    gsap.to(aboutImg, {
      yPercent: -15,
      ease: 'none',
      scrollTrigger: {
        trigger: '.about-image',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.5,
      }
    });
  }

  // ============================================
  // 5. TESTIMONIALS — 3D card flip/slide transitions
  // ============================================
  // Enhanced in the carousel code below

  // ============================================
  // Model phases parallax bg + content reveal
  // ============================================
  document.querySelectorAll('.model-phase').forEach(phase => {
    const bg = phase.querySelector('.bg-texture');
    if (bg) {
      gsap.to(bg, {
        yPercent: 20,
        ease: 'none',
        scrollTrigger: {
          trigger: phase,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.5,
        }
      });
    }

    const content = phase.querySelector('.phase-content');
    if (!isMobile) {
      gsap.from(content, {
        y: 80,
        opacity: 0,
        rotateX: -10,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: phase,
          start: 'top 70%',
          toggleActions: 'play none none none',
        }
      });
    } else {
      gsap.from(content, {
        y: 60,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: phase,
          start: 'top 70%',
          toggleActions: 'play none none none',
        }
      });
    }
  });

  // ============================================
  // 6. LEAD MAGNET — Enhanced 3D tilt with light/shadow
  // ============================================
  // (Enhanced in the mockup tilt section below)

  // ============================================
  // 7. CTA — Magnetic button + grain animation
  // ============================================
  const ctaButtons = document.querySelectorAll('.final-cta .btn-primary, .final-cta .btn-secondary');

  if (!isMobile) {
    ctaButtons.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const strength = btn.classList.contains('btn-primary') ? 0.3 : 0.15;
        gsap.to(btn, {
          x: x * strength,
          y: y * strength,
          duration: 0.3,
          ease: 'power2.out',
        });
      });

      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, {
          x: 0,
          y: 0,
          duration: 0.6,
          ease: 'elastic.out(1, 0.4)',
        });
      });
    });
  }

  // CTA title — OSMO Highlight Text on Scroll effect
  const ctaTitle = document.querySelector('.cta-title');
  if (ctaTitle && !isMobile) {
    const ctaWords = splitTextIntoWords(ctaTitle);
    // Start dimmed, light up as you scroll
    gsap.set(ctaWords, { opacity: 0.15 });
    ctaWords.forEach((word, i) => {
      gsap.to(word, {
        opacity: 1,
        color: '#FFFFFF',
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.final-cta',
          start: () => `top ${65 - i * 3}%`,
          end: () => `top ${55 - i * 3}%`,
          scrub: 0.5,
        }
      });
    });
  } else if (ctaTitle) {
    // Mobile: simple reveal
    gsap.from(ctaTitle, { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: '.final-cta', start: 'top 80%', toggleActions: 'play none none none' }
    });
  }

  // Background grain animation boost in CTA section
  const grainOverlay = document.querySelector('.final-cta .grain-overlay');
  if (grainOverlay) {
    gsap.to(grainOverlay, {
      opacity: 0.06,
      ease: 'none',
      scrollTrigger: {
        trigger: '.final-cta',
        start: 'top bottom',
        end: 'top center',
        scrub: true,
      }
    });
  }

  // ============================================
  // Footer — OSMO Parallax Reveal Effect
  // ============================================
  const footer = document.querySelector('.footer');
  const finalCta = document.querySelector('.final-cta');
  if (footer && finalCta && !isMobile) {
    // Footer sits behind the CTA section and "reveals" as CTA scrolls away
    gsap.set(footer, { position: 'relative', zIndex: 0 });
    gsap.set(finalCta, { position: 'relative', zIndex: 2 });
  }
  
  gsap.from('.footer-grid > *', {
    y: 30,
    opacity: 0,
    stagger: 0.15,
    duration: 0.6,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '.footer',
      start: 'top 90%',
      toggleActions: 'play none none none',
    }
  });

  gsap.from('.footer-socials a', {
    scale: 0,
    stagger: 0.1,
    duration: 0.4,
    ease: 'back.out(1.7)',
    scrollTrigger: {
      trigger: '.footer-socials',
      start: 'top 95%',
      toggleActions: 'play none none none',
    }
  });

  // ============================================
  // Trust bar — Animated counters (OSMO Display Count)
  // ============================================
  const trustNumbers = document.querySelectorAll('.trust-number');
  trustNumbers.forEach(el => {
    const text = el.textContent.trim();
    const match = text.match(/^([\d.]+)(.*)$/);
    if (match) {
      const num = parseFloat(match[1]);
      const suffix = match[2]; // e.g. "+" or "%" or " ★"
      const hasDecimal = match[1].includes('.');
      const decimalPlaces = hasDecimal ? (match[1].split('.')[1] || '').length : 0;
      gsap.from(el, {
        innerText: 0,
        duration: 2,
        ease: 'power2.out',
        snap: hasDecimal ? { innerText: 0.1 } : { innerText: 1 },
        scrollTrigger: {
          trigger: el,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
        onUpdate: function() {
          const val = parseFloat(el.textContent);
          el.textContent = (hasDecimal ? val.toFixed(decimalPlaces) : Math.round(val)) + suffix;
        }
      });
    }
  });

  // ============================================
  // Section visibility — enhanced reveal
  // ============================================
  document.querySelectorAll('.section').forEach(section => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 80%',
      onEnter: () => section.style.opacity = 1,
    });
  });

  // ---- Image parallax for all case images (depth effect) — desktop only ----
  // Op mobiel veroorzaakt yPercent: -12 een zichtbaar "balkje" effect omdat
  // de image-edge door de overlay-gradient heen schuift bij scroll.
  if (!isMobile) {
    document.querySelectorAll('.case-image img').forEach(img => {
      gsap.to(img, {
        yPercent: -12,
        ease: 'none',
        scrollTrigger: {
          trigger: img.closest('.case-card'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.5,
        }
      });
    });
  }

  // ---- Horizontal scroll text for a "wow" reveal ----
  const marqueeSection = document.querySelector('.marquee');
  if (marqueeSection && !isMobile) {
    gsap.fromTo(marqueeSection, {
      opacity: 0,
      y: 40,
    }, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: marqueeSection,
        start: 'top 90%',
        toggleActions: 'play none none none',
      }
    });
  }

  // ============================================
  // SOLUTIONS — Animated code blocks fly in
  // ============================================
  const codeFloats = document.querySelectorAll('.code-float');
  if (codeFloats.length) {
    codeFloats.forEach((block, i) => {
      const fromX = i === 1 ? 60 : -60;
      gsap.fromTo(block, {
        opacity: 0,
        y: 50,
        x: fromX,
        scale: 0.9,
      }, {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        duration: 1,
        delay: i * 0.2,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.solutions-code-viz',
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        onComplete: () => block.classList.add('is-visible'),
      });
    });
  }
}

// ============================================
// TESTIMONIAL CAROUSEL — 3D Card Transitions + Perspective Shift
// ============================================
const dots = document.querySelectorAll('.carousel-dots .dot');
const testimonials = document.querySelectorAll('.testimonial');
let currentSlide = 0;
let autoAdvance;

function showSlide(n, direction) {
  const current = testimonials[currentSlide];
  const next = testimonials[n];
  const dir = direction || (n > currentSlide ? 1 : -1);

  if (currentSlide === n) return;

  // 3D flip/slide out current — refined timing
  gsap.to(current, {
    rotateY: dir * -20,
    rotateX: 3,
    x: dir * -100,
    opacity: 0,
    scale: 0.88,
    filter: 'blur(4px)',
    duration: 0.45,
    ease: 'power3.in',
    onComplete: () => {
      current.classList.remove('active');
      gsap.set(current, { rotateY: 0, rotateX: 0, x: 0, scale: 1, filter: 'blur(0px)' });
    }
  });

  // 3D flip/slide in next — refined timing
  next.classList.add('active');
  gsap.fromTo(next, {
    rotateY: dir * 20,
    rotateX: -3,
    x: dir * 100,
    opacity: 0,
    scale: 0.88,
    filter: 'blur(4px)',
  }, {
    rotateY: 0,
    rotateX: 0,
    x: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    duration: 0.55,
    ease: 'power3.out',
    delay: 0.12,
  });

  dots.forEach(d => d.classList.remove('active'));
  dots[n].classList.add('active');
  currentSlide = n;
}

// Perspective-shift on hover for active testimonial
if (window.innerWidth > 767) {
  const carouselWrap = document.querySelector('.testimonial-carousel');
  if (carouselWrap) {
    carouselWrap.addEventListener('mousemove', (e) => {
      const active = carouselWrap.querySelector('.testimonial.active');
      if (!active) return;
      const rect = carouselWrap.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(active, {
        rotateY: x * 6,
        rotateX: -y * 4,
        duration: 0.4,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    });
    carouselWrap.addEventListener('mouseleave', () => {
      const active = carouselWrap.querySelector('.testimonial.active');
      if (!active) return;
      gsap.to(active, {
        rotateY: 0,
        rotateX: 0,
        duration: 0.6,
        ease: 'power2.out',
      });
    });
  }
}

dots.forEach(dot => {
  dot.addEventListener('click', () => {
    const target = parseInt(dot.dataset.slide);
    showSlide(target);
    resetAutoAdvance();
  });
});

function resetAutoAdvance() {
  clearInterval(autoAdvance);
  autoAdvance = setInterval(() => {
    const next = (currentSlide + 1) % testimonials.length;
    showSlide(next, 1);
  }, 5000);
}

resetAutoAdvance();

// Touch/swipe support for testimonials
const carouselEl = document.querySelector('.testimonial-carousel');
if (carouselEl) {
  let startX = 0;
  carouselEl.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });
  carouselEl.addEventListener('touchend', (e) => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        showSlide((currentSlide + 1) % testimonials.length, 1);
      } else {
        showSlide((currentSlide - 1 + testimonials.length) % testimonials.length, -1);
      }
      resetAutoAdvance();
    }
  }, { passive: true });
}

// ============================================
// MOCKUP TILT — Enhanced 3D with light/shadow shift
// ============================================
if (window.innerWidth > 900) {
  const mockup = document.querySelector('.mockup-img');
  const wrapper = document.querySelector('.mockup-wrapper');

  if (wrapper && mockup) {
    // Create light/glare overlay
    const glare = document.createElement('div');
    glare.className = 'mockup-glare';
    wrapper.style.position = 'relative';
    wrapper.appendChild(glare);

    wrapper.addEventListener('mousemove', (e) => {
      const rect = wrapper.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      gsap.to(mockup, {
        rotateY: x * 20,
        rotateX: -y * 15,
        duration: 0.4,
        ease: 'power2.out',
      });

      // Dynamic shadow based on tilt
      const shadowX = -x * 30;
      const shadowY = -y * 30;
      gsap.to(mockup, {
        boxShadow: `${shadowX}px ${shadowY}px 60px rgba(7,25,12,0.35)`,
        duration: 0.4,
      });

      // Move glare
      gsap.to(glare, {
        x: x * 100,
        y: y * 80,
        opacity: 0.15,
        duration: 0.4,
      });
    });

    wrapper.addEventListener('mouseleave', () => {
      gsap.to(mockup, {
        rotateY: -5,
        rotateX: 0,
        boxShadow: '0 20px 60px rgba(7,25,12,0.2)',
        duration: 0.8,
        ease: 'elastic.out(1, 0.7)',
      });
      gsap.to(glare, {
        opacity: 0,
        duration: 0.4,
      });
    });
  }
}

// ============================================
// FORM SUBMIT
// ============================================
const form = document.querySelector('.lead-form');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('.btn-primary');
    const input = form.querySelector('.lead-input');
    btn.innerHTML = '✓ Check je inbox!';
    btn.style.background = 'var(--mid-green)';
    btn.style.color = 'var(--white)';
    input.value = '';
    setTimeout(() => {
      btn.innerHTML = 'Download gratis <span class="btn-arrow">→</span>';
      btn.style.background = '';
      btn.style.color = '';
    }, 3000);
  });
}

// ============================================
// PAGE TRANSITIONS — Clean fade
// ============================================
function initPageTransitions() {
  const transition = document.getElementById('page-transition');
  if (!transition) return;

  // Intercept internal links
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:') || link.target === '_blank') return;

    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = href;

      transition.classList.add('is-active');

      // Fade to dark green, then navigate
      gsap.to(transition, {
        opacity: 1,
        duration: 0.4,
        ease: 'power2.inOut',
        onComplete: () => {
          window.location.href = target;
        }
      });
    });
  });

  // On arrival: if we came via transition, fade out the overlay
  if (sessionStorage.getItem('page-transitioning')) {
    sessionStorage.removeItem('page-transitioning');
    transition.classList.add('is-leaving');
    gsap.set(transition, { opacity: 1 });

    gsap.to(transition, {
      opacity: 0,
      duration: 0.5,
      delay: 0.15,
      ease: 'power2.out',
      onComplete: () => {
        transition.classList.remove('is-active', 'is-leaving');
        transition.style.visibility = 'hidden';
      }
    });
  }

  // Mark that we're transitioning before leaving
  window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('page-transitioning', '1');
  });

  // Safari bfcache fix: bij back-button restored Safari de DOM-state met overlay nog actief.
  // Reset 'm bij elk pageshow event waar persisted=true (= uit bfcache).
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      transition.classList.remove('is-active', 'is-leaving');
      transition.style.opacity = '0';
      transition.style.visibility = 'hidden';
      sessionStorage.removeItem('page-transitioning');
    }
  });
}
initPageTransitions();

// ============================================
// NAV LIGHT/DARK SWAP (global)
// ============================================
(function() {
  const nav = document.querySelector('.bold-nav');
  if (!nav) return;
  const sections = document.querySelectorAll('section');
  if (!sections.length) return;
  function updateNavTheme() {
    const navBottom = nav.querySelector('.bold-nav__bar')?.getBoundingClientRect().bottom || 80;
    let isLight = false;
    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      if (rect.top < navBottom && rect.bottom > 0) {
        if (sec.classList.contains('section-cream') || sec.classList.contains('sc-timeline-section')) {
          isLight = true;
        }
      }
    });
    nav.classList.toggle('nav-light', isLight);
  }
  window.addEventListener('scroll', updateNavTheme, { passive: true });
  updateNavTheme();
})();

// ---- CASE CARD HOVER VIDEOS ----
(function () {
  document.querySelectorAll('.hover-reel').forEach(function (video) {
    const card = video.closest('.case-card, .sc-portfolio-item, .sp-proof__case, .portfolio-card');
    if (!card) return;
    card.addEventListener('mouseenter', function () {
      video.play().catch(function () {});
    });
    card.addEventListener('mouseleave', function () {
      video.pause();
      video.currentTime = 0;
    });
  });
})();
