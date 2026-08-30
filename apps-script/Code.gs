/**
 * 브라스레슨 문의 게시판 / 후기 게시판 / 블로그 피드 백엔드 (Google Apps Script)
 * 설치/배포 방법은 프로젝트 루트의 SETUP.md 를 참고하세요.
 *
 * 이 스크립트가 하는 일:
 *  1) 문의글이 오면(POST) 이 스프레드시트에 한 줄 저장, 저장 즉시 OWNER_EMAIL 로 이메일 발송
 *  2) 후기가 오면(POST, type=review) 별도 시트에 저장하고 OWNER_EMAIL 로 알림 발송
 *     (승인 절차 없이 즉시 공개되므로, 이 알림이 사실상 유일한 모니터링 수단입니다.
 *      부적절한 후기를 지우려면 구글 시트에서 해당 행을 직접 삭제하면 됩니다.)
 *  3) (선택) 카카오톡 "나에게 보내기"로 알림 발송
 *  4) 목록 조회(GET)는 종류별로 분기: 기본값=문의(연락처 제외), type=reviews=후기, type=blog=네이버 블로그 RSS
 */

// ---- 설정: 아래 정보를 본인 정보로 바꿔주세요 ----
const OWNER_EMAIL = 'yooka7710@gmail.com'; // 알림을 받을 이메일 주소
const SHEET_NAME = '문의목록';
const REVIEW_SHEET_NAME = '후기목록';
const BLOG_RSS_URL = 'https://rss.blog.naver.com/raon92_.xml';
const BLOG_CACHE_SECONDS = 1800; // RSS는 30분 캐시 (방문자마다 매번 가져오면 할당량 소진)
const ENABLE_KAKAO_NOTIFY = false; // 카카오 알림을 쓰려면 true 로 변경 (SETUP.md 4번 참고)
const SCRIPT_VERSION = 'b64-v5'; // 배포가 실제 반영됐는지 확인용 (doGet 응답에 포함)
// ---------------------------------------------

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['날짜', '이름', '연락처', '악기', '제목', '문의내용']);
  }
  return sheet;
}

function getReviewSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(REVIEW_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(REVIEW_SHEET_NAME);
    sheet.appendRow(['날짜', '이름', '악기', '별점', '후기내용']);
  }
  return sheet;
}

function respond_(e, payload) {
  const callback = e && e.parameter && e.parameter.callback;
  const output = ContentService.createTextOutput();
  if (callback) {
    output.setContent(callback + '(' + JSON.stringify(payload) + ')');
    output.setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    output.setContent(JSON.stringify(payload));
    output.setMimeType(ContentService.MimeType.JSON);
  }
  return output;
}

function getInquiryList_() {
  const rows = getSheet_().getDataRange().getValues();
  rows.shift(); // 헤더 제거

  // 연락처(개인정보)는 공개 목록에 포함하지 않음
  return rows
    .map((r) => ({
      date: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      name: r[1],
      instrument: r[3],
      title: r[4],
      message: r[5],
    }))
    .reverse();
}

function getReviewList_() {
  const rows = getReviewSheet_().getDataRange().getValues();
  rows.shift(); // 헤더 제거

  return rows
    .map((r) => ({
      date: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      name: r[1],
      instrument: r[2],
      rating: Number(r[3]) || 0,
      message: r[4],
    }))
    .reverse();
}

/**
 * 네이버 블로그 RSS를 서버(Apps Script)에서 대신 가져와 파싱한다.
 * 브라우저에서 직접 rss.blog.naver.com을 fetch하면 CORS로 막히기 때문에,
 * 이미 배포된 이 웹앱을 프록시로 재사용한다. UrlFetchApp은 방문자당 호출이
 * 아니라 캐시가 비었을 때만 호출되도록 CacheService로 감싼다.
 */
function getBlogList_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('blogFeed');
  if (cached) return JSON.parse(cached);

  let items = [];
  try {
    const xml = UrlFetchApp.fetch(BLOG_RSS_URL, { muteHttpExceptions: true }).getContentText();
    const root = XmlService.parse(xml).getRootElement();
    const channel = root.getChild('channel');
    const entries = channel ? channel.getChildren('item') : [];
    items = entries.slice(0, 10).map((item) => {
      const title = (item.getChildText('title') || '').trim();
      const link = (item.getChildText('link') || '').trim();
      const pubDate = (item.getChildText('pubDate') || '').trim();
      let desc = (item.getChildText('description') || '').trim();
      desc = desc.replace(/\.{4,}\s*$/, '').trim();
      if (desc.length > 140) desc = desc.slice(0, 140).trim() + '...';
      return { title, link, pubDate, description: desc };
    });
  } catch (err) {
    console.error('블로그 RSS 조회 실패: ' + err);
    items = [];
  }

  cache.put('blogFeed', JSON.stringify(items), BLOG_CACHE_SECONDS);
  return items;
}

function doGet(e) {
  const type = e && e.parameter && e.parameter.type;
  let payload;
  if (type === 'reviews') {
    payload = { version: SCRIPT_VERSION, items: getReviewList_() };
  } else if (type === 'blog') {
    payload = { version: SCRIPT_VERSION, items: getBlogList_() };
  } else {
    payload = { version: SCRIPT_VERSION, items: getInquiryList_() };
  }
  return respond_(e, payload);
}

function instrumentLabel_(instrument) {
  return instrument === 'trumpet' ? '트럼펫' : instrument === 'trombone' ? '트롬본' : '문의';
}

/**
 * e.parameter, e.postData.contents 둘 다 POST 본문의 한글 등 non-ASCII 값을
 * 복구 불가능하게(U+FFFD) 깨뜨리는 Apps Script 버그가 있다. 클라이언트가
 * UTF-8 JSON을 base64로 감싸 보내면(base64는 전송 중 순수 ASCII라 깨질 수
 * 없음) 여기서 base64 디코딩 -> UTF-8 문자열 변환으로 원문을 안전하게 복구.
 */
function doPost(e) {
  const bytes = Utilities.base64Decode(e.postData.contents);
  const jsonStr = Utilities.newBlob(bytes).getDataAsString('UTF-8');
  const p = JSON.parse(jsonStr);

  // type이 없으면(기존에 배포된 클라이언트) 지금까지와 동일하게 문의로 처리한다.
  if (p.type === 'review') {
    return postReview_(p);
  }
  return postInquiry_(p);
}

function postInquiry_(p) {
  const name = p.name || '';
  const contact = p.contact || '';
  const instrument = p.instrument || 'etc';
  const title = p.title || '';
  const message = p.message || '';
  const date = p.date ? new Date(p.date) : new Date();

  getSheet_().appendRow([date, name, contact, instrument, title, message]);

  const label = instrumentLabel_(instrument);

  try {
    MailApp.sendEmail({
      to: OWNER_EMAIL,
      subject: `[브라스레슨 문의] ${label} - ${title}`,
      body:
        `새로운 문의가 등록되었습니다.\n\n` +
        `악기: ${label}\n` +
        `이름: ${name}\n` +
        `연락처: ${contact}\n` +
        `제목: ${title}\n\n` +
        `내용:\n${message}\n`,
    });
  } catch (err) {
    // 이메일 발송에 실패해도 문의 저장은 이미 완료된 상태로 유지
    console.error('이메일 발송 실패: ' + err);
  }

  if (ENABLE_KAKAO_NOTIFY) {
    try {
      sendKakaoToMe_(`[브라스레슨 문의]\n${label} - ${title}\n작성자: ${name}`);
    } catch (err) {
      console.error('카카오 알림 실패: ' + err);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function postReview_(p) {
  const name = p.name || '';
  const instrument = p.instrument || 'etc';
  const rating = Math.min(5, Math.max(1, Number(p.rating) || 5));
  const message = p.message || '';
  const date = p.date ? new Date(p.date) : new Date();

  getReviewSheet_().appendRow([date, name, instrument, rating, message]);

  const label = instrumentLabel_(instrument);

  // 후기는 승인 절차 없이 즉시 공개되므로, 이 알림이 사실상 유일한 모니터링 수단이다.
  try {
    MailApp.sendEmail({
      to: OWNER_EMAIL,
      subject: `[브라스레슨 후기] ${label} - 별점 ${rating}`,
      body:
        `새로운 후기가 등록되어 사이트에 즉시 공개되었습니다.\n\n` +
        `악기: ${label}\n` +
        `이름: ${name}\n` +
        `별점: ${rating} / 5\n\n` +
        `내용:\n${message}\n\n` +
        `부적절한 내용이면 구글 시트의 '${REVIEW_SHEET_NAME}' 시트에서 해당 행을 삭제하세요.\n`,
    });
  } catch (err) {
    console.error('이메일 발송 실패: ' + err);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 카카오톡 "나에게 보내기" 알림.
 * 사전 준비가 필요합니다 (SETUP.md 4번 참고):
 *  - 카카오 디벨로퍼스에서 앱 생성 후 카카오 로그인으로 access token 발급
 *  - 스크립트 속성(Project Settings > Script properties)에 KAKAO_ACCESS_TOKEN 저장
 * access token 은 유효기간이 있으므로, 만료되면 이 함수는 조용히 실패합니다
 * (이메일 알림은 별도로 항상 발송되므로 문의 자체를 놓치지는 않습니다).
 */
function sendKakaoToMe_(text) {
  const token = PropertiesService.getScriptProperties().getProperty('KAKAO_ACCESS_TOKEN');
  if (!token) return;

  const templateObject = {
    object_type: 'text',
    text: text,
    link: { web_url: 'https://brasslessons.kr/', mobile_web_url: 'https://brasslessons.kr/' },
  };

  UrlFetchApp.fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token },
    payload: { template_object: JSON.stringify(templateObject) },
    muteHttpExceptions: true,
  });
}
