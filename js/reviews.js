/*
  후기 게시판 연동 스크립트. board.js와 같은 Google Apps Script 웹앱을 사용하되,
  type=reviews / type=review 파라미터로 문의 게시판과 구분한다.
  APPS_SCRIPT_URL이 비어있으면 데모 모드(localStorage)로 동작한다.
  review.html에서 blog.js와 함께 로드되므로, 전역 변수 충돌을 막기 위해
  IIFE로 감싼다.
*/
(function () {
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxqin_xN8KRqkiUGzcMpYqmjIPb_2g0qdE7btk8Zd3zkKs2oasq-OmbwA7A6vsVmcYB/exec';

const REVIEW_DEMO_KEY = 'brasslessons_reviews_demo';
const REVIEW_INSTRUMENT_LABEL = { trumpet: '트럼펫', trombone: '트롬본', etc: '문의' };

function isConfigured() {
  return typeof APPS_SCRIPT_URL === 'string' && APPS_SCRIPT_URL.trim().length > 0;
}

function loadDemoReviews() {
  try {
    return JSON.parse(localStorage.getItem(REVIEW_DEMO_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveDemoReviews(list) {
  localStorage.setItem(REVIEW_DEMO_KEY, JSON.stringify(list));
}

function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const cbName = 'brassReviewCb_' + Date.now();
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, 8000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[cbName];
      script.remove();
    }

    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('network'));
    };
    const sep = url.includes('?') ? '&' : '?';
    script.src = url + sep + 'callback=' + cbName;
    document.body.appendChild(script);
  });
}

async function fetchReviews() {
  if (!isConfigured()) {
    return loadDemoReviews();
  }
  try {
    const data = await jsonpFetch(APPS_SCRIPT_URL + '?type=reviews');
    return Array.isArray(data) ? data : (data.items || []);
  } catch (e) {
    console.error('후기를 불러오지 못했습니다.', e);
    return null; // 네트워크 실패와 "글 없음"을 구분하기 위해 null 반환
  }
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

async function submitReview(payload) {
  if (!isConfigured()) {
    const list = loadDemoReviews();
    list.unshift(payload);
    saveDemoReviews(list);
    return { ok: true, demo: true };
  }
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: utf8ToBase64(JSON.stringify(Object.assign({ type: 'review' }, payload))),
    });
    return { ok: true, demo: false };
  } catch (e) {
    console.error('전송 실패', e);
    return { ok: false, demo: false };
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  } catch (e) {
    return iso;
  }
}

function starsHtml(rating) {
  const r = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)));
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += i < r ? '★' : '<span class="empty">★</span>';
  }
  return `<span class="stars">${html}</span>`;
}

function renderReviews(items, targetId, emptyMessage, limit) {
  const listEl = document.getElementById(targetId);
  if (!listEl) return;

  if (items === null) {
    listEl.innerHTML = `<div class="empty-state">후기를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>`;
    return;
  }
  if (!items.length) {
    listEl.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  const shown = typeof limit === 'number' ? items.slice(0, limit) : items;
  listEl.classList.toggle('few-items', shown.length < 3);
  listEl.innerHTML = shown.map((item) => {
    const label = REVIEW_INSTRUMENT_LABEL[item.instrument] || '문의';
    return `
      <div class="review-card">
        <div class="review-card-head">
          ${starsHtml(item.rating)}
          <span class="tag${item.instrument === 'trombone' ? ' trombone' : ''}">${label}</span>
        </div>
        <div class="review-card-body">${escapeHtml(item.message)}</div>
        <div class="review-card-meta">
          <span>${escapeHtml(item.name)}</span>
          <span>${formatDate(item.date)}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function refreshReviews(targetId, emptyMessage, limit) {
  const items = await fetchReviews();
  renderReviews(items, targetId, emptyMessage, limit);
  return items;
}

function setupStarWidget() {
  const widget = document.getElementById('starWidget');
  if (!widget) return;
  const input = document.getElementById('f-rating');
  const buttons = Array.from(widget.querySelectorAll('button'));

  function setRating(value) {
    input.value = value;
    buttons.forEach((btn) => {
      btn.classList.toggle('filled', Number(btn.dataset.value) <= value);
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => setRating(Number(btn.dataset.value)));
  });
  setRating(5);
}

function showStatus(msg, ok) {
  const el = document.getElementById('formStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'form-status show ' + (ok ? 'ok' : 'err');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('reviewList')) return;

  refreshReviews('reviewList', '아직 등록된 후기가 없습니다. 첫 번째 후기를 남겨보세요!');
  setupStarWidget();

  const form = document.getElementById('reviewForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const payload = {
      name: document.getElementById('f-name').value.trim(),
      instrument: document.getElementById('f-instrument').value,
      rating: Number(document.getElementById('f-rating').value) || 5,
      message: document.getElementById('f-message').value.trim(),
      date: new Date().toISOString(),
    };

    const result = await submitReview(payload);
    submitBtn.disabled = false;

    if (result.ok) {
      showStatus('후기가 등록되었습니다. 소중한 후기 감사합니다!', true);
      form.reset();
      setupStarWidget();
      refreshReviews('reviewList', '아직 등록된 후기가 없습니다. 첫 번째 후기를 남겨보세요!');
    } else {
      showStatus('전송 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.', false);
    }
  });
});
})();
