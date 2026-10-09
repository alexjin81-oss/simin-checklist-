// ============================================
// 시민제과 생산기록 API — Apps Script
// (시트 "시민제과_생산기록"에 연결된 스크립트)
// 2026-10 개정: 기록 날짜 선택(오늘/어제), 매장명 통일(효자강변점)
// ============================================
const STAFF_TAB = '직원명단';
const RECORD_TAB = '생산기록';
const TZ = 'Asia/Seoul';

// 예전 기록에 남아 있는 매장 이름을 지금 이름으로 맞춘다
const STORE_ALIASES = { '효자점': '효자강변점' };

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'login') return handleLogin(data);
    if (action === 'submit') return handleSubmit(data);
    if (action === 'getStaffList') return getStaffList();
    if (action === 'getRecords') return handleGetRecords(data);

    return jsonResponse({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  return jsonResponse({ ok: true, status: 'alive' });
}

function normStore(s) {
  const t = String(s || '').trim();
  return STORE_ALIASES[t] || t;
}

function dayStr(d) {
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function handleLogin(data) {
  const name = data.name, pin = data.pin;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STAFF_TAB);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const rowName = rows[i][0], rowPin = rows[i][1], store = rows[i][2],
          defaultFloor = rows[i][3], active = rows[i][4];
    const isActive = active === true || String(active).toUpperCase() === 'TRUE';
    if (String(rowName).trim() === String(name).trim() &&
        String(rowPin).trim() === String(pin).trim() &&
        isActive) {
      return jsonResponse({
        ok: true,
        name: rowName,
        store: normStore(store),
        defaultFloor: defaultFloor
      });
    }
  }
  return jsonResponse({ ok: false, error: '이름 또는 PIN이 맞지 않습니다' });
}

function handleSubmit(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RECORD_TAB);
  const now = new Date();
  const today = dayStr(now);
  const yesterday = dayStr(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  // 기록 날짜: 오늘이 기본. 어제분을 늦게 올리는 경우에만 어제로 저장한다.
  let dateStr = today;
  if (data.recordDate === yesterday) dateStr = yesterday;

  sheet.appendRow([
    now, dateStr, data.name, normStore(data.store), data.floor, data.period,
    data.work || '', data.waste || '', data.wasteReasons || ''
  ]);

  return jsonResponse({ ok: true, date: dateStr });
}

function getStaffList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(STAFF_TAB);
  const rows = sheet.getDataRange().getValues();
  const list = [];

  for (let i = 1; i < rows.length; i++) {
    const name = rows[i][0], store = rows[i][2], defaultFloor = rows[i][3], active = rows[i][4];
    const isActive = active === true || String(active).toUpperCase() === 'TRUE';
    if (isActive && name) {
      list.push({ name: name, store: normStore(store), defaultFloor: defaultFloor });
    }
  }
  return jsonResponse({ ok: true, list: list });
}

function handleGetRecords(data) {
  const range = data.range || 'today';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RECORD_TAB);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonResponse({ ok: true, records: [] });

  // 최근 기록만 읽는다 (오늘·어제·이번 주 조회에는 충분)
  const n = Math.min(lastRow - 1, 800);
  const rows = sheet.getRange(lastRow - n + 1, 1, n, 9).getValues();

  const now = new Date();
  const todayStr = dayStr(now);
  const yesterdayStr = dayStr(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const weekAgoStr = dayStr(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));

  const records = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] && !row[1]) continue;

    let rowDate = row[1];
    if (rowDate && typeof rowDate === 'object' && rowDate.getTime) {
      rowDate = dayStr(rowDate);
    } else {
      rowDate = String(rowDate || '');
    }

    let include = false;
    if (range === 'today' && rowDate === todayStr) include = true;
    else if (range === 'yesterday' && rowDate === yesterdayStr) include = true;
    else if (range === 'week' && rowDate >= weekAgoStr) include = true;
    if (!include) continue;

    const ts = (row[0] && row[0].getTime) ? row[0] : new Date(row[0]);
    const tsOk = !isNaN(ts.getTime());
    records.push({
      timestamp: tsOk ? ts.toISOString() : '',
      timeStr: tsOk ? Utilities.formatDate(ts, TZ, 'HH:mm') : '',
      date: rowDate,
      late: tsOk ? dayStr(ts) !== rowDate : false,   // 기록 날짜와 입력한 날이 다름
      name: row[2],
      store: normStore(row[3]),
      floor: row[4],
      period: row[5],
      work: row[6],
      waste: row[7],
      wasteReasons: row[8]
    });
  }

  records.sort(function (a, b) { return b.timestamp.localeCompare(a.timestamp); });
  return jsonResponse({ ok: true, records: records });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
