/****************************************************************
 * 시민제과 마감 기부·폐기 → Google Sheets 누적 (loss.html → /api/loss → 여기)
 * ------------------------------------------------------------
 * 설치 (한 번만)
 * 1) 구글시트 새로 만들기 (이름 예: "마감 기부·폐기 로데이터")
 * 2) 확장 프로그램 > Apps Script > 기존 코드 지우고 이 파일 전체 붙여넣기
 * 3) 배포 > 새 배포 > 유형: 웹 앱 / 실행: 나 / 액세스: 모든 사용자 > 배포
 * 4) 나온 /exec 주소를 Vercel 환경변수 LOSS_SHEET_URL 에 넣고 Redeploy
 *    (이 시트에 묶인 스크립트라 SHEET_ID 를 따로 넣을 필요 없음)
 *
 * 시트 구조: '로데이터' 탭에 품목 1개 = 1행.
 * 같은 마감일자+매장을 다시 등록하면 이전 행을 지우고 새로 적는다 (앱에서 재등록 = 덮어쓰기).
 ****************************************************************/

const TAB = '로데이터';
const HEADERS = ['마감일자', '매장', '구분', '제품명', '수량', '단위', '단가', '손실액', '작성자', '메모', '기록시각'];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(TAB);
    if (!sh) sh = ss.insertSheet(TAB);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    removeExisting_(sh, data.date, data.store);

    const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    const rows = (data.rows || []).map(function (r) {
      const price = (r.price === null || r.price === undefined || r.price === '') ? '' : Number(r.price);
      const amt = price === '' ? '' : Math.round(Number(r.qty) * price);
      return [data.date, data.store, r.cat, r.name, Number(r.qty), r.unit || '개', price, amt,
              data.writer || '', data.memo || '', now];
    });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
    return json_({ ok: true, inserted: rows.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// 같은 마감일자+매장 행 삭제 (A열 날짜, B열 매장)
function removeExisting_(sh, date, store) {
  const last = sh.getLastRow();
  if (last < 2) return;
  const vals = sh.getRange(2, 1, last - 1, 2).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    const d = vals[i][0];
    const ds = (d instanceof Date) ? Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd') : String(d);
    if (ds === date && String(vals[i][1]) === store) sh.deleteRow(i + 2);
  }
}

function doGet() { return json_({ ok: true, service: 'simin-loss-sheet' }); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 편집기에서 ▶ 실행해 보는 테스트
function testInsert() {
  const fake = { postData: { contents: JSON.stringify({
    date: '2026-10-27', store: '본점', writer: '테스트', memo: '테스트 행 — 지워도 됨',
    rows: [
      { name: '찹쌀도너츠', cat: '기부', qty: 2, unit: '개', price: 2000 },
      { name: '크로크무슈', cat: '폐기', qty: 1, unit: '개', price: null },
      { name: '찹쌀떡', cat: '재판', qty: 1, unit: 'kg', price: null }
    ]
  }) } };
  Logger.log(doPost(fake).getContent());
}
