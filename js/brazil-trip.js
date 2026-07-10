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
// ROUTE — kaartlijn tekent zichzelf bij scroll, markers poppen op,
// kaarten staggeren mee
// ============================================
(function initRoute() {
  const path = document.querySelector('.trip-route__path');
  const markers = document.querySelectorAll('.trip-route__marker');
  const cards = document.querySelectorAll('[data-route-card]');
  if (!path) return;

  const length = path.getTotalLength();
  gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
  gsap.set(markers, { scale: 0, transformOrigin: 'center', transformBox: 'fill-box' });

  // Lijn tekent zichzelf, gescrubd aan de scroll
  gsap.to(path, {
    strokeDashoffset: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: '.trip-route__stage',
      start: 'top 80%',
      end: 'top 25%',
      scrub: 0.6,
    }
  });

  // Markers poppen op zodra de lijn hun punt passeert (progress-gebaseerd)
  const markerPositions = [0, 0.3, 0.55, 0.85, 1];
  ScrollTrigger.create({
    trigger: '.trip-route__stage',
    start: 'top 80%',
    end: 'top 25%',
    onUpdate: (self) => {
      markers.forEach((m, i) => {
        if (self.progress >= markerPositions[i] && !m.dataset.shown) {
          m.dataset.shown = '1';
          gsap.to(m, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
        }
      });
    }
  });

  cards.forEach((card, i) => {
    gsap.from(card, {
      y: 40, opacity: 0,
      duration: 0.8, delay: i * 0.12, ease: 'power3.out',
      scrollTrigger: { trigger: '.trip-route__cards', start: 'top 88%', toggleActions: 'play none none none' }
    });
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
// Alle foto's zijn kitesurf-beelden van Wikimedia Commons (vrije licenties),
// waaronder echte spotfoto's van Cumbuco/Cauípe, Ilha do Guajiru, Barrinha (Jeri) en Tatajuba.
const WIKI = (path) => `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}`;

const IMG = {
  cauipeBarra: WIKI('1/11/Kites_Surfes_na_Barra_do_Cau%C3%ADpe_Caucaia-CE.jpg/1280px-Kites_Surfes_na_Barra_do_Cau%C3%ADpe_Caucaia-CE.jpg'),
  cumbuco1: WIKI('c/c8/Kitecumbuco.jpg/1280px-Kitecumbuco.jpg'),
  cumbuco2: WIKI('f/f7/Kitecumbuco2.jpg/1280px-Kitecumbuco2.jpg'),
  cumbuco3: WIKI('0/07/Kitecumbuco3.jpg/1280px-Kitecumbuco3.jpg'),
  cumbucoBeach: WIKI('6/6f/Fortaleza%2C_Cear%C3%A1%2C_Brazil%2C_Kitesurf_in_Cumbuco_Beach_-_panoramio.jpg/1280px-Fortaleza%2C_Cear%C3%A1%2C_Brazil%2C_Kitesurf_in_Cumbuco_Beach_-_panoramio.jpg'),
  praiaCumbuco: WIKI('1/13/Praia_do_cumbuco.jpg/1280px-Praia_do_cumbuco.jpg'),
  rigging: WIKI('7/73/Fortaleza%2C_Cear%C3%A1%2C_Brasil._Montando_kitesurf._Icaray._-_panoramio.jpg/1280px-Fortaleza%2C_Cear%C3%A1%2C_Brasil._Montando_kitesurf._Icaray._-_panoramio.jpg'),
  cauipe1: WIKI('0/0a/Kite_Cauipe.jpg/1280px-Kite_Cauipe.jpg'),
  cauipe3: WIKI('c/c7/Kite_Cauipe_3.jpg/1280px-Kite_Cauipe_3.jpg'),
  delta: WIKI('1/18/SSFnaDelta.jpg/1280px-SSFnaDelta.jpg'),
  aquiraz1: WIKI('2/26/Kitesurfing_on_Aquiraz.jpg/1280px-Kitesurfing_on_Aquiraz.jpg'),
  aquiraz2: WIKI('2/22/Kite_boarding_on_Aquiraz.jpg/1280px-Kite_boarding_on_Aquiraz.jpg'),
  aquiraz3: WIKI('d/d9/Kitesurfing_on_Aquiraz-Cear%C3%A1.jpg/1280px-Kitesurfing_on_Aquiraz-Cear%C3%A1.jpg'),
  araruama: WIKI('7/76/Kitesurf_na_Lagoa_de_Araruama.jpg/1280px-Kitesurf_na_Lagoa_de_Araruama.jpg'),
  guajiruReal: WIKI('4/42/Ilha_do_guajiru_-_itarema_-_ceara.jpg/1280px-Ilha_do_guajiru_-_itarema_-_ceara.jpg'),
  gostoso: WIKI('5/59/S%C3%A3o_Miguel_do_Gostoso%2C_Rio_Grande_do_Norte.jpg/1280px-S%C3%A3o_Miguel_do_Gostoso%2C_Rio_Grande_do_Norte.jpg'),
  voo: WIKI('c/cc/A_beleza_de_um_voo_de_kitesurf.jpg/1280px-A_beleza_de_um_voo_de_kitesurf.jpg'),
  jumpHigh: WIKI('c/cb/Kitesurfer_Jumping_High_In_The_Air_%2846262593652%29.jpg/1280px-Kitesurfer_Jumping_High_In_The_Air_%2846262593652%29.jpg'),
  barrinha1: WIKI('e/eb/14-_Kitesurfsport-Barrinha-Jericoacoara%2CCe_Helio_Bastos_Salmon-130722.jpg/1280px-14-_Kitesurfsport-Barrinha-Jericoacoara%2CCe_Helio_Bastos_Salmon-130722.jpg'),
  barrinha2: WIKI('e/ec/15_-Barrinha%2CSportKitesurf-Jericoacoara%2CCe_Helio_Bastos_Salmon-130722.jpg/1280px-15_-Barrinha%2CSportKitesurf-Jericoacoara%2CCe_Helio_Bastos_Salmon-130722.jpg'),
  jeriPraia: WIKI('c/c7/Praia_Principal%2CJericoacoara%2CCear%C3%A1_-_01_-Helio_Bastos_Salmon.jpg/1280px-Praia_Principal%2CJericoacoara%2CCear%C3%A1_-_01_-Helio_Bastos_Salmon.jpg'),
  jeriPraia31: WIKI('3/3a/31--PraiaPrincipal-Jericoacoara%2CCear%C3%A1-Helio-Bastos-Salmon-100722_6017.jpg/1280px-31--PraiaPrincipal-Jericoacoara%2CCear%C3%A1-Helio-Bastos-Salmon-100722_6017.jpg'),
  jeriKite: WIKI('2/21/Kite_at_Jericoacoara_beach_IMG_1110_%288354033418%29.jpg/1280px-Kite_at_Jericoacoara_beach_IMG_1110_%288354033418%29.jpg'),
  dunaSunset: WIKI('c/cf/Duna_do_por_do_sol_com_surfista.jpg/1280px-Duna_do_por_do_sol_com_surfista.jpg'),
  jeriNov22: WIKI('5/55/Jeri_Nov_12_-_image_22_%288354529604%29.jpg/1280px-Jeri_Nov_12_-_image_22_%288354529604%29.jpg'),
  jeriNov23: WIKI('1/11/Jeri_Nov_12_-_image_23_%288354533366%29.jpg/1280px-Jeri_Nov_12_-_image_23_%288354533366%29.jpg'),
  laguinho: WIKI('2/23/Laguinho_da_Torta_2016.jpg/1280px-Laguinho_da_Torta_2016.jpg'),
  canoa: WIKI('f/f2/Canoa_Quebrada_9.jpg/1280px-Canoa_Quebrada_9.jpg'),
  sunset1: WIKI('f/f9/Kitesurf_at_sunset_%2824562604416%29.jpg/1280px-Kitesurf_at_sunset_%2824562604416%29.jpg'),
  workum: WIKI('6/6a/Kitesurfer_at_sunset%2C_Workum%2C_may_2017.jpg/1280px-Kitesurfer_at_sunset%2C_Workum%2C_may_2017.jpg'),
  essaouira: WIKI('f/fd/Sunset_with_kite%2C_Essaouira%2C_Morocco.jpg/1280px-Sunset_with_kite%2C_Essaouira%2C_Morocco.jpg'),
};

const SPOT_GALLERIES = {
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
    images: [IMG.cumbuco3, IMG.cauipeBarra, IMG.praiaCumbuco],
  },
  'paracuru-a': {
    loc: 'Paracuru · 2 nachten · Optie A',
    title: 'Paracuru Kitefriends Lux Pousada',
    desc: 'Kite-pousada met ruime suites en ontbijt, gerund door en voor kiters. Dicht bij de lagune en het centrum van Paracuru.',
    specs: { 'Prijsindicatie': '± €25 pp / nacht', 'Type': 'Pousada (suites)', 'Ontbijt': 'Inbegrepen' },
    link: 'https://www.tripadvisor.com/Hotel_Review-g1720824-d7134421-Reviews-Paracuru_Kitefriends_Lux_Pousada-Paracuru_State_of_Ceara.html',
    images: [IMG.aquiraz2, IMG.delta],
  },
  'paracuru-b': {
    loc: 'Paracuru · 2 nachten · Optie B',
    title: 'Pousada Wind Paracuru',
    desc: 'No-nonsense budget-pousada met goede reviews onder kiters. Scooter- en motorverhuur op locatie (± €8 per dag) — handig om de spots rond Paracuru te verkennen.',
    specs: { 'Prijsindicatie': '± €16 pp / nacht', 'Type': 'Budget pousada', 'Extra': 'Scooterverhuur' },
    link: 'https://www.tripadvisor.com/Hotel_Review-g1720824-d6351613-Reviews-Pousada_Wind_Paracuru-Paracuru_State_of_Ceara.html',
    images: [IMG.gostoso, IMG.aquiraz1],
  },
  'guajiru-a': {
    loc: 'Ilha do Guajiru · 2 nachten · Optie A',
    title: 'Pousada Kite Guajiru',
    desc: 'Direct óp de ongetij-spot: 5 meter van het water, kiten van je terras af, hele dag varen ongeacht het tij. Uitstekend ontbijt en wifi.',
    specs: { 'Prijsindicatie': '± €42 pp / nacht', 'Type': 'Kite-pousada', 'Afstand spot': '5 m', 'Ontbijt': 'Inbegrepen' },
    link: 'https://www.kitesurfingbrazil.com/',
    images: [IMG.guajiruReal, IMG.cauipe1],
  },
  'guajiru-b': {
    loc: 'Ilha do Guajiru · 2 nachten · Optie B',
    title: 'Guajiru Kite Safari',
    desc: 'Eco-pousada aan het strand met grote Sahara-tenten (met elektriciteit en internet), gebouwd op wind- en zonne-energie. Uniek slapen, klein budget.',
    specs: { 'Prijsindicatie': '± €26 pp / nacht', 'Type': 'Eco / glamping', 'Ligging': 'Beachfront' },
    link: 'https://www.guajiru-kitesafari.com/',
    images: [IMG.voo, IMG.araruama],
  },
  'jeri-a': {
    loc: 'Jericoacoara · 2 nachten · Optie A',
    title: 'Jeri Kite Surf Pousada — privékamer',
    desc: 'Kite-pousada op 400 m van het strand en 500 m van Malhada Beach. Privékamers met airco, eigen badkamer en balkon. Ontbijtbuffet en kite-opslag.',
    specs: { 'Prijsindicatie': '± €35 pp / nacht', 'Type': 'Pousada, privékamer', 'Locatie\u00adscore': '9.5 (Booking)', 'Ontbijt': 'Inbegrepen' },
    link: 'https://www.booking.com/hotel/br/jeri-kite-surf-hostel.html',
    images: [IMG.jeriKite, IMG.barrinha1],
  },
  'jeri-b': {
    loc: 'Jericoacoara · 2 nachten · Optie B',
    title: 'Jeri Kite Surf Pousada — budgetkamer',
    desc: 'Zelfde pousada en toplocatie, maar dan de eenvoudigere kamers vanaf ± R$150 per nacht voor twee personen, ontbijt inbegrepen.',
    specs: { 'Prijsindicatie': '± €18 pp / nacht', 'Type': 'Pousada, budgetkamer', 'Ontbijt': 'Inbegrepen' },
    link: 'https://www.booking.com/hotel/br/jeri-kite-surf-hostel.html',
    images: [IMG.dunaSunset, IMG.barrinha2],
  },
  'tatajuba-a': {
    loc: 'Tatajuba · optioneel +1 nacht · Optie A',
    title: 'Kitejuba Bungalows',
    desc: 'Bungalows direct op het strand van Tatajuba, met airco, klamboe en hangmat. Voor als we de downwind niet als dagtrip maar met overnachting willen doen.',
    specs: { 'Prijsindicatie': '± €40 pp / nacht', 'Type': 'Beach bungalows', 'Ligging': 'Op het strand' },
    link: 'https://www.kitejubabungalows.com/',
    images: [IMG.sunset1, IMG.laguinho],
  },
  'tatajuba-b': {
    loc: 'Tatajuba · optioneel +1 nacht · Optie B',
    title: 'Pousada Portal do Kite',
    desc: 'Rustige pousada op 8 minuten lopen van het strand, met tuin en zonnedek. De budgetvriendelijke manier om in Tatajuba te overnachten.',
    specs: { 'Prijsindicatie': '± €20 pp / nacht', 'Type': 'Pousada', 'Afstand strand': '8 min lopen' },
    link: 'https://portal-do-kite-pousada.ceara-hotels.com/en/',
    images: [IMG.workum, IMG.essaouira],
  },
};

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

  function openGallery(key) {
    const data = SPOT_GALLERIES[key];
    if (!data) return;
    images = data.images;
    alt = data.title;
    index = 0;
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
    info.hidden = false;
    panel.classList.add('has-info');
    render();
    openModal();
  }

  document.querySelectorAll('[data-gallery-open]').forEach(btn => {
    btn.addEventListener('click', () => openGallery(btn.dataset.galleryOpen));
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

// Refresh na late layout-shifts (lazy images)
window.addEventListener('load', () => ScrollTrigger.refresh());
