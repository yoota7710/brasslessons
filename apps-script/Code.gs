/**
 * 브라스레슨 문의 게시판 백엔드 (Google Apps Script)
 * 설치/배포 방법은 프로젝트 루트의 SETUP.md 를 참고하세요.
 *
 * 이 스크립트가 하는 일:
 *  1) 문의글이 오면(POST) 이 스프레드시트에 한 줄 저장
 *  2) 저장 즉시 OWNER_EMAIL 로 이메일 발송
 *  3) (선택) 카카오톡 "나에게 보내기"로 알림 발송
 *  4) 목록 조회(GET)는 개인정보(연락처)를 제외하고 응답
 */

// ---- 설정: 아래 두 줄만 본인 정보로 바꿔주세요 ----
const OWNER_EMAIL = 'yooka7710@gmail.com'; // 문의 알림을 받을 이메일 주소
const SHEET_NAME = '문의목록';
const ENABLE_KAKAO_NOTIFY = false; // 카카오 알림을 쓰려면 true 로 변경 (SETUP.md 4번 참고)
const SCRIPT_VERSION = 'b64-v4'; // 배포가 실제 반영됐는지 확인용 (doGet 응답에 포함)
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

function doGet(e) {
  const sheet = getSheet_();
  const rows = sheet.getDataRange().getValues();
  rows.shift(); // 헤더 제거

  // 연락처(개인정보)는 공개 목록에 포함하지 않음
  const items = rows
    .map((r) => ({
      date: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      name: r[1],
      instrument: r[3],
      title: r[4],
      message: r[5],
    }))
    .reverse();

  const payload = { version: SCRIPT_VERSION, items };
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
  const name = p.name || '';
  const contact = p.contact || '';
  const instrument = p.instrument || 'etc';
  const title = p.title || '';
  const message = p.message || '';
  const date = p.date ? new Date(p.date) : new Date();

  getSheet_().appendRow([date, name, contact, instrument, title, message]);

  const instrumentLabel = instrument === 'trumpet' ? '트럼펫' : instrument === 'trombone' ? '트롬본' : '문의';

  try {
    MailApp.sendEmail({
      to: OWNER_EMAIL,
      subject: `[브라스레슨 문의] ${instrumentLabel} - ${title}`,
      body:
        `새로운 문의가 등록되었습니다.\n\n` +
        `악기: ${instrumentLabel}\n` +
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
      sendKakaoToMe_(`[브라스레슨 문의]\n${instrumentLabel} - ${title}\n작성자: ${name}`);
    } catch (err) {
      console.error('카카오 알림 실패: ' + err);
    }
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
    link: { web_url: 'https://sites.google.com/view/brasslessons', mobile_web_url: 'https://sites.google.com/view/brasslessons' },
  };

  UrlFetchApp.fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token },
    payload: { template_object: JSON.stringify(templateObject) },
    muteHttpExceptions: true,
  });
}
