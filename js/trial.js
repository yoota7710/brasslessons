/*
  체험레슨 신청 연동 스크립트. board.js와 같은 Apps Script 웹앱을 사용하되,
  type: 'trial' 로 구분해 별도 시트(체험레슨신청)에 저장한다.
  APPS_SCRIPT_URL이 비어 있으면(데모 모드) 이 브라우저에만 저장되고 이메일은 발송되지 않는다.
*/
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxqin_xN8KRqkiUGzcMpYqmjIPb_2g0qdE7btk8Zd3zkKs2oasq-OmbwA7A6vsVmcYB/exec';

const DEMO_KEY = 'brasslessons_trials_demo';

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

/**
 * Apps Script의 e.parameter / e.postData.contents는 POST 본문의 한글 등
 * non-ASCII 값을 복구 불가능하게 깨뜨리는 버그가 있다. base64는 전송 중
 * 순수 ASCII만 쓰기 때문에 이 문제를 원천적으로 피할 수 있다.
 */
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

async function submitTrial(payload) {
  if (!isConfigured()) {
    const list = loadDemoList();
    list.unshift(payload);
    saveDemoList(list);
    return { ok: true, demo: true };
  }
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: utf8ToBase64(JSON.stringify(payload)),
    });
    return { ok: true, demo: false };
  } catch (e) {
    console.error('전송 실패', e);
    return { ok: false, demo: false };
  }
}

function showStatus(msg, ok) {
  const el = document.getElementById('formStatus');
  el.textContent = msg;
  el.className = 'form-status show ' + (ok ? 'ok' : 'err');
}

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('t-date');
  if (dateInput) {
    const today = new Date();
    dateInput.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  const form = document.getElementById('trialForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const name = document.getElementById('t-name').value.trim();
    const instrument = document.getElementById('t-instrument').value;
    const preferredDate = document.getElementById('t-date').value;
    const preferredTime = document.getElementById('t-time').value;
    const instrumentLabel = { trumpet: '트럼펫', trombone: '트롬본', etc: '문의' }[instrument] || '문의';

    const payload = {
      type: 'trial',
      name,
      contact: document.getElementById('t-contact').value.trim(),
      instrument,
      preferredDate,
      preferredTime,
      // 구버전(재배포 전) Apps Script는 type을 무시하고 문의로 저장하므로,
      // title/message에도 희망 날짜/시간을 남겨 재배포 전에도 내용이 보이게 한다.
      title: `[체험레슨 신청] ${instrumentLabel} - ${preferredDate} ${preferredTime}`,
      message: document.getElementById('t-message').value.trim(),
      date: new Date().toISOString(),
    };

    const result = await submitTrial(payload);
    submitBtn.disabled = false;

    if (result.ok) {
      showStatus('체험레슨 신청이 접수되었습니다. 담당 선생님과 일정을 조율해 연락드릴게요!', true);
      form.reset();
    } else {
      showStatus('전송 중 문제가 발생했습니다. 잠시 후 다시 시도하거나 카톡으로 문의해주세요.', false);
    }
  });
});
