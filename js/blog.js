/*
  네이버 블로그(raon92_) 최신 글 목록. Google Apps Script가 서버에서 RSS를
  대신 가져와(type=blog) CORS 문제 없이 JSONP로 돌려준다.
  review.html에서 reviews.js와 함께 로드되므로, 전역 변수 충돌을 막기 위해
  IIFE로 감싼다.
*/
(function () {
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxqin_xN8KRqkiUGzcMpYqmjIPb_2g0qdE7btk8Zd3zkKs2oasq-OmbwA7A6vsVmcYB/exec';

function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const cbName = 'brassBlogCb_' + Date.now();
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

function formatDate(rfc822) {
  try {
    const d = new Date(rfc822);
    if (isNaN(d.getTime())) return rfc822;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  } catch (e) {
    return rfc822;
  }
}

async function fetchBlogPosts() {
  if (!APPS_SCRIPT_URL) return null;
  try {
    const data = await jsonpFetch(APPS_SCRIPT_URL + '?type=blog');
    return Array.isArray(data) ? data : (data.items || []);
  } catch (e) {
    console.error('블로그 글을 불러오지 못했습니다.', e);
    return null;
  }
}

function renderBlogList(items, targetId, limit) {
  const listEl = document.getElementById(targetId);
  if (!listEl) return;

  if (items === null) {
    listEl.innerHTML = `<div class="empty-state">지금은 글을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.</div>`;
    return;
  }
  if (!items.length) {
    listEl.innerHTML = `<div class="empty-state">아직 등록된 글이 없습니다.</div>`;
    return;
  }

  const shown = typeof limit === 'number' ? items.slice(0, limit) : items;
  listEl.innerHTML = shown.map((item) => `
    <a class="blog-item" href="${escapeHtml(item.link)}" target="_blank" rel="noopener">
      <div class="blog-item-title">${escapeHtml(item.title)}</div>
      <div class="blog-item-meta">${formatDate(item.pubDate)}</div>
      <div class="blog-item-desc">${escapeHtml(item.description)}</div>
    </a>
  `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  const listEl = document.getElementById('blogList');
  if (!listEl) return;
  const limitAttr = listEl.dataset.limit;
  const limit = limitAttr ? Number(limitAttr) : undefined;
  const items = await fetchBlogPosts();
  renderBlogList(items, 'blogList', limit);
});
})();
