/* ============================================ */
/* CONTACT PAGE — JavaScript                   */
/* ============================================ */

(function() {
  'use strict';

  // Skip alle entry-animaties op mobile — gsap.from zet inline opacity:0 wat
  // op iOS Safari soms niet meer terugkomt (ScrollTrigger miss / Lenis-conflict).
  // Resultaat zonder skip: form + title kort zichtbaar, dan weg.
  const isMobile = window.innerWidth <= 767;

  // ---- FORM FIELD ANIMATIONS ----
  const formGroups = document.querySelectorAll('.contact-form .form-group');

  if (formGroups.length && !isMobile) {
    gsap.from(formGroups, {
      x: 40,
      opacity: 0,
      stagger: 0.1,
      duration: 0.7,
      ease: 'power3.out',
      delay: 0.5,
      scrollTrigger: {
        trigger: '.contact-form-wrapper',
        start: 'top 80%',
        toggleActions: 'play none none none',
      }
    });

    gsap.from('.form-submit', {
      y: 20,
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out',
      delay: 1.1,
      scrollTrigger: {
        trigger: '.contact-form-wrapper',
        start: 'top 80%',
        toggleActions: 'play none none none',
      }
    });
  }

  // ---- HERO TITLE SPLIT REVEAL ----
  const contactTitle = document.querySelector('.contact-title');
  if (contactTitle && !isMobile) {
    const lines = contactTitle.querySelectorAll('.line');
    gsap.from(lines, {
      y: '100%',
      opacity: 0,
      stagger: 0.12,
      duration: 0.9,
      ease: 'power3.out',
      delay: 0.2,
    });
  }

  // ---- FORM VALIDATION + SUBMIT ----
  const form = document.getElementById('contact-form');
  const successEl = document.getElementById('form-success');

  // Proper email regex (RFC 5322-lite — catches common typos without being overly strict)
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function animateSuccess() {
    const tl = gsap.timeline();
    tl.to(form, {
      opacity: 0,
      x: -30,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: () => {
        form.style.display = 'none';
        successEl.classList.add('visible');
      }
    })
    .to('.success-icon', { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.7)' })
    .to('.success-check', { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, '-=0.2')
    .to('.form-success h3', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.2')
    .to('.form-success p', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.2');
  }

  function showError(field) {
    field.closest('.form-group').classList.add('error');
  }

  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      // Clear previous errors
      form.querySelectorAll('.form-group.error').forEach(g => g.classList.remove('error'));

      // Validate required fields
      let valid = true;
      const nameField = form.querySelector('#name');
      const emailField = form.querySelector('#email');

      if (!nameField.value.trim()) {
        showError(nameField);
        valid = false;
      }

      if (!EMAIL_REGEX.test(emailField.value.trim())) {
        showError(emailField);
        valid = false;
      }

      if (!valid) return;

      // Submit to the endpoint configured on the <form action="..."> attribute.
      // If action is missing or is a "#" placeholder, fall back to animation-only
      // (useful for local dev) but log a warning so it's visible in prod.
      const endpoint = form.getAttribute('action');
      const submitBtn = form.querySelector('.form-submit, button[type="submit"]');
      const originalLabel = submitBtn ? submitBtn.innerHTML : null;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Versturen…';
      }

      if (!endpoint || endpoint === '#' || endpoint === '') {
        // No endpoint configured — play success animation but warn
        console.warn('[contact-form] No action endpoint set on <form>. Submission is NOT being sent anywhere. Set action="https://formspree.io/f/YOUR_ID" or another handler.');
        animateSuccess();
        return;
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
          animateSuccess();
        } else {
          // Server-side rejection — show a generic error
          form.querySelectorAll('.form-group').forEach(g => g.classList.add('error'));
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalLabel;
          }
          console.error('[contact-form] Submission failed:', response.status);
        }
      } catch (err) {
        form.querySelectorAll('.form-group').forEach(g => g.classList.add('error'));
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalLabel;
        }
        console.error('[contact-form] Network error:', err);
      }
    });

    // Clear error on focus
    form.querySelectorAll('input, textarea').forEach(field => {
      field.addEventListener('focus', () => {
        field.closest('.form-group').classList.remove('error');
      });
    });
  }

  // ---- MAGNETIC HOVER ON SUBMIT BUTTON ----
  const submitBtn = document.querySelector('.form-submit');
  if (submitBtn && window.innerWidth > 767) {
    submitBtn.addEventListener('mousemove', (e) => {
      const rect = submitBtn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(submitBtn, {
        x: x * 0.15,
        y: y * 0.15,
        duration: 0.3,
        ease: 'power2.out',
      });
    });

    submitBtn.addEventListener('mouseleave', () => {
      gsap.to(submitBtn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1,0.5)' });
    });
  }

  // ---- CONTACT DETAILS STAGGER ----
  if (!isMobile) {
    gsap.from('.contact-detail', {
      y: 20,
      opacity: 0,
      stagger: 0.12,
      duration: 0.6,
      ease: 'power2.out',
      delay: 0.6,
      scrollTrigger: {
        trigger: '.contact-details',
        start: 'top 85%',
        toggleActions: 'play none none none',
      }
    });
  }

})();
