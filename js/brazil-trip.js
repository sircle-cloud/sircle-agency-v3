// ============================================
// BRAZIL KITE TRIP 2026 — onepager interactions
// GSAP + ScrollTrigger + Lenis (zelfde stack als main.js)
// ============================================

// Fallback: als de CDN-scripts niet laden, toon de pagina zonder animaties
if (typeof gsap === 'undefined' || typeof Lenis === 'undefined') {
  document.documentElement.classList.add('no-gsap');
  document.getElementById('tripLoader')?.classList.add('is-done');
  throw new Error('GSAP/Lenis niet geladen — statische fallback actief');
}

gsap.registerPlugin(ScrollTrigger);

const isMobile = window.innerWidth < 768;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- LENIS SMOOTH SCROLL (gekoppeld aan GSAP ticker, zoals main.js) ----
const lenis = window.lenis = new Lenis({
  duration: 1.0,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
});

gsap.ticker.add((time) => { lenis.raf(time * 1000); });
gsap.ticker.lagSmoothing(0);
lenis.on('scroll', ScrollTrigger.update);

// ---- HELPERS ----
function splitTextIntoWords(el) {
  const text = el.textContent.trim();
  const words = text.split(/\s+/);
  el.innerHTML = '';
  el.setAttribute('aria-label', text);
  const spans = [];
  words.forEach((word, i) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = word;
    span.setAttribute('aria-hidden', 'true');
    el.appendChild(span);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    spans.push(span);
  });
  return spans;
}

// ============================================
// LOADER — teller 0 → 100 met fallback
// ============================================
(function initLoader() {
  const loader = document.getElementById('tripLoader');
  const countEl = document.getElementById('tripLoaderCount');
  if (!loader || !countEl) return;

  let done = false;
  const counter = { val: 0 };

  function finish() {
    if (done) return;
    done = true;
    loader.classList.add('is-done');
    initHeroIntro();
  }

  gsap.to(counter, {
    val: 100,
    duration: prefersReducedMotion ? 0.2 : 1.4,
    ease: 'power2.inOut',
    onUpdate: () => { countEl.textContent = Math.round(counter.val); },
    onComplete: finish,
  });

  // Fallback: nooit langer dan 4s blijven hangen
  setTimeout(finish, 4000);
})();

// ============================================
// HERO — word-stagger intro + Ken Burns slideshow
// ============================================
function initHeroIntro() {
  const lines = document.querySelectorAll('[data-split-words]');
  const allWords = [];
  lines.forEach(line => allWords.push(...splitTextIntoWords(line)));

  gsap.set(allWords, { yPercent: 110, opacity: 0 });
  gsap.to(allWords, {
    yPercent: 0,
    opacity: 1,
    duration: 1.1,
    stagger: 0.08,
    ease: 'power3.out',
    delay: 0.15,
  });
}

(function initHeroSlideshow() {
  const slides = document.querySelectorAll('.trip-hero__slide');
  const video = document.querySelector('.trip-hero__video');

  // Video alleen tonen als het bestand echt bestaat en kan afspelen
  if (video) {
    video.addEventListener('canplay', () => {
      video.style.display = 'block';
      slides.forEach(s => { s.style.display = 'none'; });
    }, { once: true });
    video.querySelector('source')?.addEventListener('error', () => { video.remove(); });
  }

  if (slides.length < 2 || prefersReducedMotion) return;
  let current = 0;
  setInterval(() => {
    if (video && video.style.display === 'block') return;
    slides[current].classList.remove('is-active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('is-active');
  }, 5500);
})();

// Hero parallax bij scroll
gsap.to('.trip-hero__bg', {
  yPercent: 18,
  ease: 'none',
  scrollTrigger: {
    trigger: '.trip-hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
  }
});

// ============================================
// NAV — background bij scroll + smooth anchors
// ============================================
(function initNav() {
  const nav = document.querySelector('[data-trip-nav]');
  if (!nav) return;

  ScrollTrigger.create({
    start: 80,
    onEnter: () => nav.classList.add('is-scrolled'),
    onLeaveBack: () => nav.classList.remove('is-scrolled'),
  });

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.2, offset: -70 });
    });
  });
})();

// ============================================
// GENERIC REVEALS (.reveal-up / .reveal-clip — zelfde patroon als main.js)
// ============================================
document.querySelectorAll('.reveal-up').forEach(el => {
  const delay = parseFloat(el.dataset.delay) || 0;
  gsap.to(el, {
    y: 0, opacity: 1, filter: 'blur(0px)',
    duration: 1.0, delay, ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' }
  });
});

document.querySelectorAll('.reveal-clip').forEach(el => {
  const delay = parseFloat(el.dataset.delay) || 0;
  gsap.to(el, {
    clipPath: 'inset(0 0 0 0)', opacity: 1,
    duration: 0.8, delay, ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' }
  });
});

// ============================================
// ROUTE — echte kaart, lijn tekent zich OOST→WEST (rechts→links),
// pins poppen mee en zijn gekoppeld aan de spot-kaarten (Airbnb-stijl)
// ============================================
(function initRoute() {
  const path = document.querySelector('.trip-routemap__path');
  const pins = Array.from(document.querySelectorAll('.trip-routemap__pin'));
  const cards = Array.from(document.querySelectorAll('[data-route-card]'));
  if (!path) return;

  // De polyline loopt Cumbuco(rechts) → Tatajuba(links). De lijn 'van punt 0
  // naar het einde' tekenen = rechts naar links = met de wind mee naar het westen.
  const length = path.getTotalLength();
  gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
  gsap.set(pins, { scale: 0, opacity: 0, transformOrigin: 'center' });

  gsap.to(path, {
    strokeDashoffset: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: '.trip-routemap',
      start: 'top 78%',
      end: 'center 45%',
      scrub: 0.6,
    }
  });

  // Pins poppen in volgorde rechts→links terwijl de lijn hun punt passeert
  const pinAt = [0, 0.28, 0.62, 0.9, 1];
  ScrollTrigger.create({
    trigger: '.trip-routemap',
    start: 'top 78%',
    end: 'center 45%',
    onUpdate: (self) => {
      pins.forEach((pin, i) => {
        if (self.progress >= pinAt[i] && !pin.dataset.shown) {
          pin.dataset.shown = '1';
          gsap.to(pin, { scale: 1, opacity: 1, duration: 0.55, ease: 'elastic.out(1, 0.55)' });
        }
      });
    }
  });

  cards.forEach((card, i) => {
    gsap.from(card, {
      y: 40, opacity: 0,
      duration: 0.8, delay: i * 0.1, ease: 'power3.out',
      scrollTrigger: { trigger: '.trip-route__cards', start: 'top 88%', toggleActions: 'play none none none' }
    });
  });

  // ---- Kaart ↔ kaarten koppelen (hover + klik) ----
  function highlight(idx, on) {
    const pin = pins[idx];
    const card = cards.find(c => +c.dataset.routeCard === idx);
    if (pin) pin.classList.toggle('is-active', on);
    if (card) card.classList.toggle('is-active', on);
  }
  function goToAnchor(el) {
    const sel = el.dataset.anchor;
    const target = sel && document.querySelector(sel);
    if (target) lenis.scrollTo(target, { duration: 1.2, offset: -60 });
  }
  pins.forEach((pin, i) => {
    pin.addEventListener('mouseenter', () => highlight(i, true));
    pin.addEventListener('mouseleave', () => highlight(i, false));
    pin.addEventListener('click', () => goToAnchor(pin));
  });
  cards.forEach((card) => {
    const i = +card.dataset.routeCard;
    card.addEventListener('mouseenter', () => highlight(i, true));
    card.addEventListener('mouseleave', () => highlight(i, false));
    card.addEventListener('click', () => goToAnchor(card));
  });
})();

// ============================================
// SPOTS — subtiele parallax op de foto's
// ============================================
if (!isMobile && !prefersReducedMotion) {
  document.querySelectorAll('.trip-spot__image img').forEach(img => {
    gsap.fromTo(img, { yPercent: -6 }, {
      yPercent: 6,
      ease: 'none',
      scrollTrigger: {
        trigger: img.closest('.trip-spot'),
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      }
    });
  });
}

// CTA achtergrond parallax
gsap.fromTo('.trip-cta__bg', { yPercent: -10 }, {
  yPercent: 10,
  ease: 'none',
  scrollTrigger: {
    trigger: '.trip-cta',
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
  }
});

// ============================================
// TABS — Optie A / Optie B
// ============================================
(function initTabs() {
  const buttons = document.querySelectorAll('.trip-tabs__btn');
  const panels = document.querySelectorAll('[data-tab-panel]');
  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      buttons.forEach(b => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      panels.forEach(panel => {
        const show = panel.dataset.tabPanel === tab;
        panel.hidden = !show;
        if (show) {
          gsap.fromTo(panel.querySelectorAll('.trip-acco-card'),
            { y: 24, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out' });
        }
      });
      ScrollTrigger.refresh();
    });
  });
})();

// ============================================
// DATA — galerijen per kite-spot & accommodatie-details
// Prijzen zijn indicatief; links naar de aanbieder voor actuele tarieven.
// ============================================
// Alle foto's komen uit onze eigen Brazil 2024-map (Donkey Lagoon, Sony A7M4).
const P = (n) => `assets/brazil-2024/donkey-${String(n).padStart(2, '0')}.jpg`;

const IMG = {
  cauipeBarra: P(24), cumbuco1: P(5), cumbuco2: P(10), cumbuco3: P(6),
  cumbucoBeach: P(20), praiaCumbuco: P(22), rigging: P(17), cauipe1: P(23),
  cauipe3: P(31), delta: P(21), aquiraz1: P(25), aquiraz2: P(29), aquiraz3: P(30),
  araruama: P(20), guajiruReal: P(22), gostoso: P(6), voo: P(8), jumpHigh: P(19),
  barrinha1: P(34), barrinha2: P(10), jeriPraia: P(24), jeriPraia31: P(27),
  jeriKite: P(11), dunaSunset: P(16), jeriNov22: P(39), jeriNov23: P(40),
  laguinho: P(27), canoa: P(36), sunset1: P(10), workum: P(16), essaouira: P(3),
}

const SPOT_GALLERIES = {
  brazil2024: {
    get title() { return 'Brazil 2024'; },
    get images() { return TRIP_PHOTOS_2024; },
  },
  cumbuco: {
    title: 'Cumbuco',
    images: [IMG.cauipeBarra, IMG.cumbuco2, IMG.cauipe3, IMG.praiaCumbuco, IMG.cumbuco1, IMG.rigging],
  },
  paracuru: {
    title: 'Paracuru',
    images: [IMG.delta, IMG.aquiraz2, IMG.aquiraz1, IMG.cumbucoBeach],
  },
  guajiru: {
    title: 'Ilha do Guajiru',
    images: [IMG.guajiruReal, IMG.cauipe1, IMG.araruama, IMG.aquiraz3],
  },
  jeri: {
    title: 'Jericoacoara',
    images: [IMG.barrinha1, IMG.barrinha2, IMG.dunaSunset, IMG.jeriKite, IMG.jeriPraia31, IMG.jeriNov22],
  },
  tatajuba: {
    title: 'Tatajuba',
    images: [IMG.laguinho, IMG.canoa, IMG.jeriNov23, IMG.sunset1],
  },
};

const ACCOMMODATIONS = {
  'windtown': {
    loc: 'Cumbuco · 3 nachten · Optie A & B',
    title: 'Windtown Beach Hotel',
    desc: 'Hét kitehotel van Cumbuco: eigen kiteschool, materiaal\u00adopslag, zwembad en 2 minuten van de spot. Ontbijtbuffet inbegrepen. Deze ligt vast — hier starten we de trip.',
    specs: { 'Prijsindicatie': '± €38 pp / nacht', 'Type': 'Hotel + kiteschool', 'Afstand spot': '± 100 m', 'Ontbijt': 'Inbegrepen' },
    link: 'https://www.windtown-brazil.com/',
    images: ['assets/brazil-2024/acco/windtown-hotel.jpg', 'assets/brazil-2024/acco/windtown-room.jpg', 'assets/brazil-2024/acco/windtown-pool.jpg', 'assets/brazil-2024/acco/windtown-rooftop.jpg', 'assets/brazil-2024/acco/windtown-school.jpg'],
    photoCredit: 'Foto’s: Windtown Beach Hotel',
  },
  'paracuru-a': {
    loc: 'Paracuru · 2 nachten · Optie A',
    title: 'Paracuru Kitefriends Lux Pousada',
    desc: 'Kite-pousada met ruime suites en ontbijt, gerund door en voor kiters. Dicht bij de lagune en het centrum van Paracuru.',
    specs: { 'Prijsindicatie': '± €25 pp / nacht', 'Type': 'Pousada (suites)', 'Ontbijt': 'Inbegrepen' },
    link: 'https://www.tripadvisor.com/Hotel_Review-g1720824-d7134421-Reviews-Paracuru_Kitefriends_Lux_Pousada-Paracuru_State_of_Ceara.html',
    images: ['assets/brazil-2024/acco/paracuru-beach.jpg', 'assets/brazil-2024/acco/paracuru-pano.jpg'],
    photoCredit: 'Sfeerbeeld Paracuru · kamers: zie Booking',
  },
  'paracuru-b': {
    loc: 'Paracuru · 2 nachten · Optie B',
    title: 'Pousada Wind Paracuru',
    desc: 'No-nonsense budget-pousada met goede reviews onder kiters. Scooter- en motorverhuur op locatie (± €8 per dag) — handig om de spots rond Paracuru te verkennen.',
    specs: { 'Prijsindicatie': '± €16 pp / nacht', 'Type': 'Budget pousada', 'Extra': 'Scooterverhuur' },
    link: 'https://www.tripadvisor.com/Hotel_Review-g1720824-d6351613-Reviews-Pousada_Wind_Paracuru-Paracuru_State_of_Ceara.html',
    images: ['assets/brazil-2024/acco/paracuru-munguba.jpg', 'assets/brazil-2024/acco/paracuru-beach.jpg'],
    photoCredit: 'Sfeerbeeld Paracuru · kamers: zie Booking',
  },
  'guajiru-a': {
    loc: 'Ilha do Guajiru · 2 nachten · Optie A',
    title: 'Pousada Kite Guajiru',
    desc: 'Direct óp de ongetij-spot: 5 meter van het water, kiten van je terras af, hele dag varen ongeacht het tij. Uitstekend ontbijt en wifi.',
    specs: { 'Prijsindicatie': '± €42 pp / nacht', 'Type': 'Kite-pousada', 'Afstand spot': '5 m', 'Ontbijt': 'Inbegrepen' },
    link: 'https://www.kitesurfingbrazil.com/',
    images: ['assets/brazil-2024/acco/guajiru-a.jpg', 'assets/brazil-2024/acco/guajiru-place.jpg'],
    photoCredit: 'Foto: Pousada Kite Guajiru',
  },
  'guajiru-b': {
    loc: 'Ilha do Guajiru · 2 nachten · Optie B',
    title: 'Guajiru Kite Safari',
    desc: 'Eco-pousada aan het strand met grote Sahara-tenten (met elektriciteit en internet), gebouwd op wind- en zonne-energie. Uniek slapen, klein budget.',
    specs: { 'Prijsindicatie': '± €26 pp / nacht', 'Type': 'Eco / glamping', 'Ligging': 'Beachfront' },
    link: 'https://www.guajiru-kitesafari.com/',
    images: ['assets/brazil-2024/acco/safari-tent.jpg', 'assets/brazil-2024/acco/safari-tentroof.jpg', 'assets/brazil-2024/acco/safari-beach.jpg'],
    photoCredit: 'Foto’s: Guajiru Kite Safari',
  },
  'jeri-a': {
    loc: 'Jericoacoara · 2 nachten · Optie A',
    title: 'Jeri Kite Surf Pousada — privékamer',
    desc: 'Kite-pousada op 400 m van het strand en 500 m van Malhada Beach. Privékamers met airco, eigen badkamer en balkon. Ontbijtbuffet en kite-opslag.',
    specs: { 'Prijsindicatie': '± €35 pp / nacht', 'Type': 'Pousada, privékamer', 'Locatie\u00adscore': '9.5 (Booking)', 'Ontbijt': 'Inbegrepen' },
    link: 'https://www.booking.com/hotel/br/jeri-kite-surf-hostel.html',
    images: ['assets/brazil-2024/acco/jeri-place.jpg', 'assets/brazil-2024/acco/jeri-duna.jpg'],
    photoCredit: 'Sfeerbeeld Jericoacoara · kamers: zie Booking',
  },
  'jeri-b': {
    loc: 'Jericoacoara · 2 nachten · Optie B',
    title: 'Jeri Kite Surf Pousada — budgetkamer',
    desc: 'Zelfde pousada en toplocatie, maar dan de eenvoudigere kamers vanaf ± R$150 per nacht voor twee personen, ontbijt inbegrepen.',
    specs: { 'Prijsindicatie': '± €18 pp / nacht', 'Type': 'Pousada, budgetkamer', 'Ontbijt': 'Inbegrepen' },
    link: 'https://www.booking.com/hotel/br/jeri-kite-surf-hostel.html',
    images: ['assets/brazil-2024/acco/jeri-duna.jpg', 'assets/brazil-2024/acco/jeri-place.jpg'],
    photoCredit: 'Sfeerbeeld Jericoacoara · kamers: zie Booking',
  },
  'tatajuba-a': {
    loc: 'Tatajuba · optioneel +1 nacht · Optie A',
    title: 'Kitejuba Bungalows',
    desc: 'Bungalows direct op het strand van Tatajuba, met airco, klamboe en hangmat. Voor als we de downwind niet als dagtrip maar met overnachting willen doen.',
    specs: { 'Prijsindicatie': '± €40 pp / nacht', 'Type': 'Beach bungalows', 'Ligging': 'Op het strand' },
    link: 'https://www.kitejubabungalows.com/',
    images: ['assets/brazil-2024/acco/tatajuba-place.jpg', 'assets/brazil-2024/acco/tatajuba-place2.jpg'],
    photoCredit: 'Sfeerbeeld Tatajuba · kamers: zie aanbieder',
  },
  'tatajuba-b': {
    loc: 'Tatajuba · optioneel +1 nacht · Optie B',
    title: 'Pousada Portal do Kite',
    desc: 'Rustige pousada op 8 minuten lopen van het strand, met tuin en zonnedek. De budgetvriendelijke manier om in Tatajuba te overnachten.',
    specs: { 'Prijsindicatie': '± €20 pp / nacht', 'Type': 'Pousada', 'Afstand strand': '8 min lopen' },
    link: 'https://portal-do-kite-pousada.ceara-hotels.com/en/',
    images: ['assets/brazil-2024/acco/tatajuba-place2.jpg', 'assets/brazil-2024/acco/tatajuba-place.jpg'],
    photoCredit: 'Sfeerbeeld Tatajuba · kamers: zie aanbieder',
  },
};

// ============================================
// BRAZIL 2024 — masonry-galerij
// LET OP: dit is de fotolijst van de eigen 2024-trip.
// Zodra de map met eigen foto's in assets/brazil-2024/ staat:
// vervang de paden hieronder (1 regel per foto) — de masonry,
// lightbox en volgorde volgen automatisch.
// ============================================
const TRIP_PHOTOS_2024 = [
  P(2), P(24), P(14), P(10), P(21), P(16), P(8), P(20),
  P(27), P(6), P(23), P(31), P(34), P(11), P(39), P(5),
  P(13), P(29), P(36), P(19),
];

(function initMasonry() {
  const wrap = document.getElementById('masonry2024');
  if (!wrap) return;
  TRIP_PHOTOS_2024.forEach((src, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trip-masonry__item';
    btn.setAttribute('data-gallery-open', 'brazil2024');
    btn.setAttribute('data-gallery-index', String(i));
    btn.setAttribute('aria-label', `Foto ${i + 1} uit Brazil 2024 groot bekijken`);
    const img = document.createElement('img');
    img.src = src;
    img.loading = 'lazy';
    img.alt = `Brazil 2024 — kitefoto ${i + 1}`;
    btn.appendChild(img);
    wrap.appendChild(btn);
  });
  // rustige stagger-reveal bij scroll
  gsap.from(wrap.children, {
    y: 32, opacity: 0,
    duration: 0.8, stagger: 0.06, ease: 'power3.out',
    scrollTrigger: { trigger: wrap, start: 'top 85%', toggleActions: 'play none none none' }
  });
})();

// ============================================
// COUNTDOWN — tikt af naar vertrek
// ============================================
(function initCountdown() {
  const blocks = document.querySelectorAll('[data-countdown]');
  if (!blocks.length) return;
  const pad = (n) => String(n).padStart(2, '0');
  function tick() {
    blocks.forEach(block => {
      const target = new Date(block.dataset.countdown).getTime();
      let diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 86400000);
      const h = Math.floor(diff / 3600000) % 24;
      const m = Math.floor(diff / 60000) % 60;
      const sec = Math.floor(diff / 1000) % 60;
      const set = (k, v) => { const el = block.querySelector(`[data-cd="${k}"]`); if (el) el.textContent = v; };
      set('d', d); set('h', pad(h)); set('m', pad(m)); set('s', pad(sec));
    });
  }
  tick();
  setInterval(tick, 1000);
})();

// ============================================
// MODAL — foto-galerij (spots) + info-panel (accommodaties)
// ============================================
(function initModal() {
  const modal = document.getElementById('tripModal');
  if (!modal) return;

  const panel = modal.querySelector('.trip-modal__panel');
  const imgEl = modal.querySelector('.trip-modal__img');
  const counter = modal.querySelector('.trip-modal__counter');
  const prevBtn = modal.querySelector('.trip-modal__nav--prev');
  const nextBtn = modal.querySelector('.trip-modal__nav--next');
  const info = document.getElementById('tripModalInfo');
  const infoLoc = modal.querySelector('.trip-modal__loc');
  const infoTitle = modal.querySelector('.trip-modal__title');
  const infoDesc = modal.querySelector('.trip-modal__desc');
  const infoSpecs = modal.querySelector('.trip-modal__specs');
  const infoLink = modal.querySelector('.trip-modal__link');

  let images = [];
  let index = 0;
  let alt = '';

  function render() {
    imgEl.src = images[index];
    imgEl.alt = alt;
    counter.textContent = `${index + 1} / ${images.length}`;
    const nav = images.length > 1 ? '' : 'none';
    prevBtn.style.display = nav;
    nextBtn.style.display = nav;
    counter.style.display = nav;
  }

  function openModal() {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    lenis.stop();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    lenis.start();
  }

  function openGallery(key, startIndex = 0) {
    const data = SPOT_GALLERIES[key];
    if (!data) return;
    images = data.images;
    alt = data.title;
    index = Math.min(startIndex, images.length - 1);
    info.hidden = true;
    panel.classList.remove('has-info');
    render();
    openModal();
  }

  function openAcco(key) {
    const data = ACCOMMODATIONS[key];
    if (!data) return;
    images = data.images;
    alt = data.title;
    index = 0;
    infoLoc.textContent = data.loc;
    infoTitle.textContent = data.title;
    infoDesc.textContent = data.desc;
    infoSpecs.innerHTML = '';
    Object.entries(data.specs).forEach(([k, v]) => {
      const row = document.createElement('dl');
      row.className = 'trip-modal__spec';
      row.innerHTML = `<dt>${k}</dt><dd>${v}</dd>`;
      infoSpecs.appendChild(row);
    });
    infoLink.href = data.link;
    // foto-bronvermelding (echte accommodatiefoto of sfeerbeeld van de plek)
    let creditEl = info.querySelector('.trip-modal__credit');
    if (!creditEl) {
      creditEl = document.createElement('p');
      creditEl.className = 'trip-modal__credit';
      infoLink.parentNode.insertBefore(creditEl, infoLink);
    }
    creditEl.textContent = data.photoCredit || '';
    creditEl.style.display = data.photoCredit ? '' : 'none';
    info.hidden = false;
    panel.classList.add('has-info');
    render();
    openModal();
  }

  document.querySelectorAll('[data-gallery-open]').forEach(btn => {
    btn.addEventListener('click', () => openGallery(btn.dataset.galleryOpen, parseInt(btn.dataset.galleryIndex || '0', 10)));
  });
  document.querySelectorAll('[data-acco-open]').forEach(card => {
    card.addEventListener('click', () => openAcco(card.dataset.accoOpen));
  });
  modal.querySelectorAll('[data-modal-close]').forEach(el => {
    el.addEventListener('click', closeModal);
  });

  prevBtn.addEventListener('click', () => { index = (index - 1 + images.length) % images.length; render(); });
  nextBtn.addEventListener('click', () => { index = (index + 1) % images.length; render(); });

  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'ArrowLeft') { index = (index - 1 + images.length) % images.length; render(); }
    else if (e.key === 'ArrowRight') { index = (index + 1) % images.length; render(); }
  });
})();

// ============================================
// STEMMEN op de itinerary (client-side, bewaard in localStorage)
// Elke reiziger stemt op zijn eigen toestel; totalen worden per toestel
// bewaard en zijn te delen via WhatsApp/de groepsapp.
// ============================================
(function initVote() {
  const wrap = document.querySelector('[data-vote]');
  if (!wrap) return;
  const KEY = 'bkt26-votes';
  const LABELS = { jeri: 'Optie 1 · Jeri Focus', tour: 'Optie 2 · Grote Tour' };
  const statusEl = document.querySelector('[data-vote-status]');
  const shareEl = document.querySelector('[data-vote-share]');
  const resetEl = document.querySelector('[data-vote-reset]');

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { jeri: 0, tour: 0, mine: null }; }
    catch (e) { return { jeri: 0, tour: 0, mine: null }; }
  }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }

  function render() {
    const v = read();
    const total = v.jeri + v.tour || 1;
    document.querySelectorAll('[data-count]').forEach(el => { el.textContent = v[el.dataset.count]; });
    document.querySelectorAll('[data-bar]').forEach(el => { el.style.width = ((v[el.dataset.bar] / total) * 100) + '%'; });
    document.querySelectorAll('.trip-vote-card').forEach(card => {
      card.classList.toggle('is-picked', v.mine === card.dataset.option);
    });
    if (v.mine) {
      const winner = v.jeri === v.tour ? null : (v.jeri > v.tour ? 'jeri' : 'tour');
      statusEl.textContent = `Jouw stem: ${LABELS[v.mine]}. Stand: ${v.jeri}–${v.tour}` +
        (winner ? ` · ${LABELS[winner]} leidt.` : ' · gelijkspel.');
    } else {
      statusEl.textContent = 'Nog geen stem uitgebracht — kies hierboven.';
    }
    if (shareEl) {
      const txt = `Mijn stem voor Brazil 2026: ${v.mine ? LABELS[v.mine] : '—'} (stand ${v.jeri}–${v.tour}). Wat kies jij?`;
      shareEl.href = 'https://wa.me/?text=' + encodeURIComponent(txt);
    }
  }

  document.querySelectorAll('[data-vote-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const opt = btn.dataset.voteBtn;
      const v = read();
      if (v.mine === opt) return;      // al op deze optie gestemd
      if (v.mine) v[v.mine]--;          // stem verplaatsen
      v[opt]++;
      v.mine = opt;
      write(v);
      render();
      gsap.fromTo(btn, { scale: 0.96 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' });
    });
  });

  if (resetEl) resetEl.addEventListener('click', () => { write({ jeri: 0, tour: 0, mine: null }); render(); });

  render();
})();

// Refresh na late layout-shifts (lazy images)
window.addEventListener('load', () => ScrollTrigger.refresh());
