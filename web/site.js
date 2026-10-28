(() => {
  'use strict';
  // ── 홈: 매물 검색·필터 ──
  const form = document.querySelector('#search-form');
  if (form) {
    const type = document.querySelector('#property-type');
    const deal = document.querySelector('#deal-type');
    const keyword = document.querySelector('#keyword');
    const buttons = [...document.querySelectorAll('[data-filter]')];
    const cards = [...document.querySelectorAll('#listing-grid .property-card')];
    const empty = document.querySelector('#empty-state');
    const count = document.querySelector('#result-count');

    const apply = () => {
      const q = keyword.value.trim().toLowerCase();
      let shown = 0;
      cards.forEach(card => {
        const ok = (type.value === 'all' || card.dataset.group === type.value)
          && (deal.value === 'all' || card.dataset.deal === deal.value)
          && (!q || card.dataset.keywords.toLowerCase().includes(q));
        card.hidden = !ok;
        if (ok) shown++;
      });
      buttons.forEach(b => {
        const on = b.dataset.filter === type.value;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      count.textContent = `총 ${shown}개 매물`;
      if (cards.length) empty.hidden = shown !== 0;
      try { sessionStorage.setItem('rodeo-filter', JSON.stringify({ t: type.value, d: deal.value, q: keyword.value })); } catch {}
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      apply();
      document.querySelector('#properties').scrollIntoView({ behavior: 'smooth' });
    });
    [type, deal].forEach(s => s.addEventListener('change', apply));
    buttons.forEach(b => b.addEventListener('click', () => { type.value = b.dataset.filter; apply(); }));
    try {
      const saved = JSON.parse(sessionStorage.getItem('rodeo-filter') || 'null');
      if (saved) { type.value = saved.t; deal.value = saved.d; keyword.value = saved.q; if (!type.value) type.value = 'all'; apply(); }
    } catch {}
  }

  // ── 상세: 사진 갤러리 ──
  const main = document.querySelector('#gallery-main-image');
  if (main) {
    const thumbs = [...document.querySelectorAll('.gallery-thumb')];
    const caption = document.querySelector('#gallery-caption');
    const dialog = document.querySelector('#photo-dialog');
    const big = document.querySelector('#expanded-photo');
    let current = 0;
    const select = i => {
      current = (i + thumbs.length) % thumbs.length;
      const b = thumbs[current];
      main.src = b.dataset.full;
      main.alt = `사진 ${b.dataset.index}`;
      caption.textContent = `사진 ${b.dataset.index} / ${thumbs.length}`;
      thumbs.forEach((t, n) => t.setAttribute('aria-pressed', String(n === current)));
      if (dialog.open) big.src = b.dataset.full;
    };
    thumbs.forEach((b, i) => b.addEventListener('click', () => select(i)));
    document.querySelector('.gallery-main').addEventListener('click', () => {
      big.src = thumbs[current].dataset.full;
      if (dialog.showModal) dialog.showModal(); else window.open(big.src);
    });
    document.querySelector('#close-photo').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') select(current + 1);
      if (e.key === 'ArrowLeft') select(current - 1);
    });
    // 모바일 스와이프
    let x0 = null;
    const area = document.querySelector('.gallery-main');
    area.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    area.addEventListener('touchend', e => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { select(current + (dx < 0 ? 1 : -1)); e.preventDefault(); }
      x0 = null;
    });
  }
})();
