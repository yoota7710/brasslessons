/*
  문의 게시판 연동 스크립트.

  실제 서버(Google Apps Script)를 연결하려면:
  1. apps-script/Code.gs 를 구글 시트에 배포한다 (SETUP.md 참고).
  2. 배포 후 발급되는 웹앱 URL을 아래 APPS_SCRIPT_URL 에 붙여넣는다.
  이 값이 비어 있으면 브라우저의 localStorage 만 사용하는 "데모 모드"로 동작한다.
  데모 모드에서는 이메일 발송이 되지 않고, 이 브라우저에만 글이 저장된다.
*/
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzWZSiyR5qr1OK5kaJfAGUY8im6Oi2lhGIqed48NNHixRVn_WCbTbZoLiS8CEmphYUZ/exec';

const DEMO_KEY = 'brasslessons_inquiries_demo';
const INSTRUMENT_LABEL = { trumpet: '트럼펫', trombone: '트롬본', etc: '문의' };

function isConfigured() {
  return typeof APPS_SCRIPT_URL === 'string' && APPS_SCRIPT_URL.trim().length > 0;
}

function loadDemoList() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveDemoList(list) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(list));
}

function jsonpFetch(url) {
  return new Promise((resolve, reject) => {
    const cbName = 'brassCb_' + Date.now();
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

async function fetchInquiries() {
  if (!isConfigured()) {
    return loadDemoList();
  }
  try {
    const data = await jsonpFetch(APPS_SCRIPT_URL);
    return Array.isArray(data) ? data : (data.items || []);
  } catch (e) {
    console.error('게시글을 불러오지 못했습니다.', e);
    return [];
  }
}

async function submitInquiry(payload) {
  if (!isConfigured()) {
    const list = loadDemoList();
    list.unshift(payload);
    saveDemoList(list);
    return { ok: true, demo: true };
  }
  try {
    const body = new URLSearchParams(payload);
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body,
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

function renderList(items) {
  const listEl = document.getElementById('boardList');
  const countEl = document.getElementById('countLabel');
  countEl.textContent = `문의글 ${items.length}건`;

  if (!items.length) {
    listEl.innerHTML = '<div class="board-empty">아직 등록된 문의가 없습니다. 첫 번째 문의를 남겨보세요!</div>';
    return;
  }

  listEl.innerHTML = items.map((item, idx) => {
    const tagClass = item.instrument === 'trombone' ? 'tag trombone' : 'tag';
    const label = INSTRUMENT_LABEL[item.instrument] || '문의';
    return `
      <div class="board-item" data-idx="${idx}">
        <div class="board-item-head">
          <div class="board-item-title">
            <span class="${tagClass}">${label}</span>
            ${escapeHtml(item.title)}
          </div>
          <div class="board-item-meta">
            <span>${escapeHtml(item.name)}</span>
            <span>${formatDate(item.date)}</span>
          </div>
        </div>
        <div class="board-item-body"><p>${escapeHtml(item.message)}</p></div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.board-item-head').forEach((head) => {
    head.addEventListener('click', () => {
      head.parentElement.classList.toggle('open');
    });
  });
}

function showStatus(msg, ok) {
  const el = document.getElementById('formStatus');
  el.textContent = msg;
  el.className = 'form-status show ' + (ok ? 'ok' : 'err');
}

async function refreshBoard() {
  const items = await fetchInquiries();
  renderList(items);
}

document.addEventListener('DOMContentLoaded', () => {
  refreshBoard();

  const form = document.getElementById('inquiryForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const payload = {
      name: document.getElementById('f-name').value.trim(),
      contact: document.getElementById('f-contact').value.trim(),
      instrument: document.getElementById('f-instrument').value,
      title: document.getElementById('f-title').value.trim(),
      message: document.getElementById('f-message').value.trim(),
      date: new Date().toISOString(),
    };

    const result = await submitInquiry(payload);
    submitBtn.disabled = false;

    if (result.ok) {
      showStatus('문의가 등록되었습니다. 담당 선생님께 이메일로 전달됩니다!', true);
      form.reset();
      refreshBoard();
    } else {
      showStatus('전송 중 문제가 발생했습니다. 잠시 후 다시 시도하거나 카톡으로 문의해주세요.', false);
    }
  });
});
