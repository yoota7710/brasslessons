/*
  홈페이지 미리보기 위젯: 최근 후기 3개 + 블로그 최신 글 3개.
  전체 목록/작성은 review.html, blog.html에서 처리하며, 이 스크립트는
  같은 Apps Script 웹앱을 조회 전용(GET)으로만 사용한다.
*/
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxqin_xN8KRqkiUGzcMpYqmjIPb_2g0qdE7btk8Zd3zkKs2oasq-OmbwA7A6vsVmcYB/exec';
const HOME_PREVIEW_COUNT = 3;
const INSTRUMENT_LABEL = { trumpet: '트럼펫', trombone: '트롬본', etc: '문의' };

function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const cbName = 'brassHomeCb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatDate(value) {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  } catch (e) {
    return value;
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

async function fetchList(type) {
  if (!APPS_SCRIPT_URL) return null;
  try {
    const data = await jsonpFetch(APPS_SCRIPT_URL + '?type=' + type);
    return Array.isArray(data) ? data : (data.items || []);
  } catch (e) {
    console.error(type + ' 목록을 불러오지 못했습니다.', e);
    return null;
  }
}

async function renderHomeReviews() {
  const el = document.getElementById('homeReviewList');
  if (!el) return;
  const items = await fetchList('reviews');
  if (items === null) {
    el.innerHTML = `<div class="empty-state">후기를 불러오지 못했습니다.</div>`;
    return;
  }
  if (!items.length) {
    el.innerHTML = `<div class="empty-state">아직 등록된 후기가 없습니다. 첫 번째 후기를 남겨보세요!</div>`;
    return;
  }
  const shown = items.slice(0, HOME_PREVIEW_COUNT);
  el.classList.toggle('few-items', shown.length < 3);
  el.innerHTML = shown.map((item) => {
    const label = INSTRUMENT_LABEL[item.instrument] || '문의';
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

async function renderHomeBlog() {
  const el = document.getElementById('homeBlogList');
  if (!el) return;
  const items = await fetchList('blog');
  if (items === null) {
    el.innerHTML = `<div class="empty-state">지금은 글을 불러올 수 없습니다.</div>`;
    return;
  }
  if (!items.length) {
    el.innerHTML = `<div class="empty-state">아직 등록된 글이 없습니다.</div>`;
    return;
  }
  el.innerHTML = items.slice(0, HOME_PREVIEW_COUNT).map((item) => `
    <a class="blog-item" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">
      <div class="blog-item-title">${escapeHtml(item.title)}</div>
      <div class="blog-item-meta">${formatDate(item.pubDate)}</div>
      <div class="blog-item-desc">${escapeHtml(item.description)}</div>
    </a>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  renderHomeReviews();
  renderHomeBlog();
});
