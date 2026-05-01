// Lightbox gallery — vanilla JS, no deps
(function () {
  const items = Array.from(document.querySelectorAll('[data-lightbox]'));
  if (items.length === 0) return;

  // Build lightbox overlay
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <button type="button" class="lightbox__close" aria-label="Sluiten">✕</button>
    <button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="Vorige">‹</button>
    <img class="lightbox__img" src="" alt="">
    <button type="button" class="lightbox__nav lightbox__nav--next" aria-label="Volgende">›</button>
    <span class="lightbox__counter"></span>
  `;
  document.body.appendChild(overlay);

  const imgEl = overlay.querySelector('.lightbox__img');
  const counter = overlay.querySelector('.lightbox__counter');
  const closeBtn = overlay.querySelector('.lightbox__close');
  const prevBtn = overlay.querySelector('.lightbox__nav--prev');
  const nextBtn = overlay.querySelector('.lightbox__nav--next');

  let currentIndex = 0;

  function show(index) {
    currentIndex = (index + items.length) % items.length;
    const item = items[currentIndex];
    const fullSrc = item.dataset.lightboxFull || item.querySelector('img').src;
    const alt = item.querySelector('img').alt || '';
    imgEl.src = fullSrc;
    imgEl.alt = alt;
    counter.textContent = `${currentIndex + 1} / ${items.length}`;
  }

  function open(index) {
    show(index);
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (window.lenis && typeof window.lenis.stop === 'function') window.lenis.stop();
  }

  function close() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (window.lenis && typeof window.lenis.start === 'function') window.lenis.start();
  }

  items.forEach((item, idx) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      open(idx);
    });
  });

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => show(currentIndex - 1));
  nextBtn.addEventListener('click', () => show(currentIndex + 1));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(currentIndex - 1);
    else if (e.key === 'ArrowRight') show(currentIndex + 1);
  });
})();
