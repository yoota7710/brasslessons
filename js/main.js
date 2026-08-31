document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('active');
      mainNav.classList.toggle('open');
    });
    mainNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        mainNav.classList.remove('open');
      });
    });
  }

  document.querySelectorAll('.faq-item').forEach((item) => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((openItem) => {
        if (openItem !== item) {
          openItem.classList.remove('open');
          openItem.querySelector('.faq-a').style.maxHeight = null;
        }
      });
      if (isOpen) {
        item.classList.remove('open');
        a.style.maxHeight = null;
      } else {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach((b) => b.classList.toggle('active', b === btn));
      tabPanels.forEach((p) => p.classList.toggle('active', p.dataset.tab === target));
    });
  });

  document.querySelectorAll('.carousel-arrow').forEach((btn) => {
    btn.addEventListener('click', () => {
      const track = document.getElementById(btn.dataset.target);
      if (!track) return;
      const dir = btn.classList.contains('prev') ? -1 : 1;
      track.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('.program-tabs').forEach((tabGroup) => {
    const programBtns = tabGroup.querySelectorAll('.program-btn');
    const programPanels = tabGroup.parentElement.querySelectorAll('.program-panel');
    programBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.program;
        programBtns.forEach((b) => b.classList.toggle('active', b === btn));
        programPanels.forEach((p) => p.classList.toggle('active', p.dataset.program === target));
      });
    });
  });
});
