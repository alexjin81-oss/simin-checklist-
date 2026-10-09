// ============================================
// 시민제과 관리시스템 API — Apps Script (노션 + 구글시트 중계)
// (시트 "시민제과_생산 관리시스템"에 연결된 스크립트)
// 2026-10 개정:
//  - 재고: 하루 1행 덮어쓰기(날짜 비교 오류 수정), 품목명 정규화, 빈 행 방지
//  - "어제 재고"는 오늘 이전의 실제 마지막 값만 사용
//  - 리더 입력 현황(getStatus), 대표·부장 PIN 서버 확인
//  - 노션 토큰·PIN은 코드가 아니라 [프로젝트 설정 → 스크립트 속성]에 저장
//      NOTION_TOKEN / CEO_PIN / SUPERVISOR_PIN
//  - 노션 점검 기록은 하루 1건(같은 날 다시 저장하면 덮어쓰기)
// ============================================
const NOTION_DB_ID = '6369a579-c16c-40b0-8221-0a06d6f32e6c';
const SHEET_ID = '12-doLOFJP45u1I9BzrAv4i1Eps1H_p5W1COvtAVygqM';
const NOTION_VERSION = '2022-06-28';
const TZ = 'Asia/Seoul';
const FLOORS = ['2F', '3F', '4F'];
const PIN_KEYS = { ceo: 'CEO_PIN', supervisor: 'SUPERVISOR_PIN' };

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const action = req.action;
    let result;

    if (action === 'saveSupervisor')      result = saveSupervisor(req);
    else if (action === 'saveInventory')  result = saveInventory(req);
    else if (action === 'getInventory')   result = getInventory(req);
    else if (action === 'getStatus')      result = getStatus(req);
    else if (action === 'setNotice')      result = setNotice(req);
    else if (action === 'getNotice')      result = getNotice(req);
    else if (action === 'checkPin')       result = checkPin(req);
    else result = { ok: false, error: 'unknown action: ' + action };

    return json(result);
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, msg: '시민제과 관리시스템 API 작동중' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// 공통
// ============================================
function prop(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function todayStr() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function daysAgoStr(n) {
  return Utilities.formatDate(new Date(Date.now() - n * 24 * 60 * 60 * 1000), TZ, 'yyyy-MM-dd');
}

// 시트의 날짜 칸은 날짜 형식으로 바뀌어 저장되므로, 비교 전에 항상 글자로 맞춘다
function dateKey(cell, ssTz) {
  if (cell === '' || cell === null || cell === undefined) return '';
  if (typeof cell === 'object' && cell.getTime) {
    return Utilities.formatDate(cell, ssTz || TZ, 'yyyy-MM-dd');
  }
  return String(cell).trim().slice(0, 10);
}

function cleanName(s) {
  return String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim();
}

// 품목명 비교용: "[추가]" 표시와 띄어쓰기 차이를 무시한다
function normName(s) {
  return cleanName(s).replace(/^\[추가\]\s*/, '').replace(/\s+/g, '').toLowerCase();
}

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

function toCell(v) {
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === '') return '';
  const n = Number(s);
  return isNaN(n) ? s : n;
}

function readHeader(sh) {
  const lastCol = sh.getLastColumn();
  if (sh.getLastRow() < 1 || lastCol < 1) return [];
  return sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return cleanName(h); });
}

// 품목명 → 열 번호. 정확히 같은 이름이 먼저, 없으면 띄어쓰기·[추가]만 다른 열을 쓴다.
function findColumn(header, name) {
  const exact = header.indexOf(name);
  if (exact > 0) return exact;
  const key = normName(name);
  if (!key) return -1;
  let fallback = -1;
  for (let c = 1; c < header.length; c++) {
    if (normName(header[c]) !== key) continue;
    if (header[c].indexOf('[추가]') !== 0) return c;   // 정식 품목 열 우선
    if (fallback === -1) fallback = c;
  }
  return fallback;
}

function ensureColumns(sh, count) {
  const max = sh.getMaxColumns();
  if (count > max) sh.insertColumnsAfter(max, count - max);
}

// ============================================
// PIN (대표 / 부장)
// ============================================
function pinState(role, pin) {
  const key = PIN_KEYS[role];
  if (!key) return { ok: false, error: '알 수 없는 역할입니다' };
  const real = prop(key);
  if (!real) return { ok: false, unset: true, error: 'PIN이 아직 설정되지 않았습니다 (스크립트 속성 ' + key + ')' };

  const cache = CacheService.getScriptCache();
  const failKey = 'pinfail_' + role;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= 5) return { ok: false, locked: true, error: '여러 번 틀려서 5분간 잠겼습니다' };

  if (String(pin === undefined || pin === null ? '' : pin).trim() === String(real).trim()) {
    return { ok: true };
  }
  cache.put(failKey, String(fails + 1), 300);
  return { ok: false, auth: true, error: '비밀번호가 올바르지 않습니다' };
}

function checkPin(req) {
  return pinState(req.role, req.pin);
}

// ============================================
// 1) 부장 일일 점검 → 노션 저장 (하루 1건)
// ============================================
function saveSupervisor(req) {
  const auth = pinState('supervisor', req.pin);
  if (!auth.ok) return auth;

  const token = prop('NOTION_TOKEN');
  if (!token) return { ok: false, error: '노션 토큰이 설정되지 않았습니다 (스크립트 속성 NOTION_TOKEN)' };

  const d = req.data || {};
  const today = todayStr();
  const isDraft = d.status === 'draft';

  const props = {
    '날짜':            { title: [{ text: { content: today + ' 부장 점검' } }] },
    '작성일':          { date: { start: today } },
    '조회 진행':       { checkbox: !!d.s1 },
    '전날 폐기 확인':  { checkbox: !!d.s2 },
    '폐기 메모':       rich(d.s2memo),
    '2F 워크인 확인':  { checkbox: !!d.wk2 },
    '2F 메모':         rich(d.memo2),
    '3F 워크인 확인':  { checkbox: !!d.wk3 },
    '3F 메모':         rich(d.memo3),
    '4F 워크인 확인':  { checkbox: !!d.wk4 },
    '4F 메모':         rich(d.memo4),
    '주요 제품 품질 확인': { checkbox: !!d.quality },
    '품질 확인 메모':  rich(d.qualitymemo),
    '빵앙금(박스)':    num(d.bang),
    '떡앙금(박스)':    num(d.ddeok),
    '버터(kg)':        num(d.butter),
    '생크림(통)':      num(d.cream),
    '공장 위생 점검':  { checkbox: !!d.hyg },
    '위생 메모':       rich(d.hygmemo),
    '사전예약 수량':   num(d.preorder),
    '중요·대량 예약건': rich(d.prememo),
    '익일 생산계획':   { checkbox: !!d.plan },
    '오늘 코멘트':     rich(d.comment),
    '상태':            { select: { name: isDraft ? '📝 작성중' : '✅ 작성완료' } }
  };

  const headers = {
    'Authorization': 'Bearer ' + token,
    'Notion-Version': NOTION_VERSION
  };

  // 오늘 기록이 이미 있으면 그 페이지를 고친다 (찾기에 실패하면 새로 만든다)
  let pageId = '';
  try { pageId = findTodayPage(headers, today); } catch (err) { pageId = ''; }

  let res;
  if (pageId) {
    res = UrlFetchApp.fetch('https://api.notion.com/v1/pages/' + pageId, {
      method: 'patch',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify({ properties: props }),
      muteHttpExceptions: true
    });
  } else {
    res = UrlFetchApp.fetch('https://api.notion.com/v1/pages', {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify({ parent: { database_id: NOTION_DB_ID }, properties: props }),
      muteHttpExceptions: true
    });
  }

  const code = res.getResponseCode();
  if (code === 200 || code === 201) return { ok: true, updated: !!pageId, draft: isDraft };
  return { ok: false, error: 'notion ' + code + ': ' + res.getContentText() };
}

function findTodayPage(headers, today) {
  const res = UrlFetchApp.fetch('https://api.notion.com/v1/databases/' + NOTION_DB_ID + '/query', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify({
      filter: { property: '작성일', date: { equals: today } },
      page_size: 1
    }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return '';
  const body = JSON.parse(res.getContentText());
  return (body.results && body.results.length) ? body.results[0].id : '';
}

function rich(s) {
  return { rich_text: s ? [{ text: { content: String(s).slice(0, 2000) } }] : [] };
}
function num(v) {
  if (v === '' || v === null || v === undefined) return { number: null };
  const n = Number(v);
  return { number: isNaN(n) ? null : n };
}

// ============================================
// 2) 리더 재고 → 구글시트 저장 (날짜별 1행, 같은 날은 덮어쓰기)
// ============================================
function saveInventory(req) {
  const floor = String(req.floor || '');
  if (FLOORS.indexOf(floor) === -1) return { ok: false, error: 'unknown floor: ' + floor };
  const items = req.items || {};
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName('재고_' + floor);
  if (!sh) return { ok: false, error: 'no sheet: 재고_' + floor };
  const ssTz = ss.getSpreadsheetTimeZone();

  // 값이 있는 품목만 추린다 (빈 값은 저장하지 않는다 → 빈 행이 생기지 않음)
  const entries = [];
  Object.keys(items).forEach(function (k) {
    const name = cleanName(k);
    const v = items[k];
    if (!name || isBlank(v) || String(v).trim() === '') return;
    entries.push({ name: name, value: toCell(v) });
  });
  if (!entries.length) return { ok: false, error: '입력한 품목이 없습니다' };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const today = todayStr();
    let header = readHeader(sh);
    if (!header.length) {
      header = ['날짜'];
      sh.getRange(1, 1).setValue('날짜');
    }

    // 품목 → 열 (없는 품목만 새 열 추가)
    const updates = {};
    entries.forEach(function (en) {
      let col = findColumn(header, en.name);
      if (col === -1) {
        header.push(en.name);
        col = header.length - 1;
        ensureColumns(sh, header.length);
        sh.getRange(1, header.length).setValue(en.name);
      }
      updates[col] = en.value;
    });

    // 오늘 행 찾기 (예전 중복 행이 있으면 가장 아래 행을 쓴다)
    const lastRow = sh.getLastRow();
    let rowNum = -1;
    if (lastRow >= 2) {
      const n = Math.min(lastRow - 1, 60);
      const start = lastRow - n + 1;
      const dates = sh.getRange(start, 1, n, 1).getValues();
      for (let i = n - 1; i >= 0; i--) {
        if (dateKey(dates[i][0], ssTz) === today) { rowNum = start + i; break; }
      }
    }

    let row;
    if (rowNum === -1) {
      row = [];
      for (let c = 0; c < header.length; c++) row.push('');
      row[0] = today;
    } else {
      ensureColumns(sh, header.length);
      row = sh.getRange(rowNum, 1, 1, header.length).getValues()[0];
    }
    Object.keys(updates).forEach(function (c) { row[Number(c)] = updates[c]; });

    if (rowNum === -1) sh.appendRow(row);
    else sh.getRange(rowNum, 1, 1, row.length).setValues([row]);

    return { ok: true, saved: entries.length, date: today, overwritten: rowNum !== -1 };
  } finally {
    lock.releaseLock();
  }
}

// 최근 행들을 읽어 [날짜키, 행] 목록으로 돌려준다
function readRecentRows(sh, ssTz, maxRows) {
  const lastRow = sh.getLastRow();
  const header = readHeader(sh);
  if (lastRow < 2 || header.length < 2) return { header: header, rows: [] };
  const n = Math.min(lastRow - 1, maxRows);
  const values = sh.getRange(lastRow - n + 1, 1, n, header.length).getValues();
  const rows = values.map(function (r) { return { date: dateKey(r[0], ssTz), cells: r }; });
  return { header: header, rows: rows };
}

// ============================================
// 3) 재고 읽기 — 오늘 이전의 마지막 값(참고용) + 오늘 이미 저장한 값
// ============================================
function getInventory(req) {
  const floor = String(req.floor || '');
  if (FLOORS.indexOf(floor) === -1) return { ok: false, error: 'unknown floor: ' + floor };
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName('재고_' + floor);
  const today = todayStr();
  const empty = { ok: true, items: {}, prev: {}, today: {}, todaySaved: false, date: today };
  if (!sh) return empty;

  const data = readRecentRows(sh, ss.getSpreadsheetTimeZone(), 60);
  if (!data.rows.length) return empty;

  const cutoff = daysAgoStr(14);          // 2주보다 오래된 값은 참고로 쓰지 않는다
  const prev = {};                         // 정규화 품목명 → { v, d }
  const todayVals = {};                    // 정규화 품목명 → 값
  const items = {};                        // (구버전 화면 호환) 열 이름 → 이전 값

  for (let i = data.rows.length - 1; i >= 0; i--) {
    const r = data.rows[i];
    if (!r.date) continue;
    for (let c = 1; c < data.header.length; c++) {
      const v = r.cells[c];
      if (isBlank(v)) continue;
      const key = normName(data.header[c]);
      if (!key) continue;
      if (r.date === today) {
        if (!(key in todayVals)) todayVals[key] = v;
      } else if (r.date < today && r.date >= cutoff) {
        if (!(key in prev)) {
          prev[key] = { v: v, d: r.date };
          items[data.header[c]] = v;
        }
      }
    }
  }

  return {
    ok: true,
    items: items,
    prev: prev,
    today: todayVals,
    todaySaved: Object.keys(todayVals).length > 0,
    date: today,
    yesterday: daysAgoStr(1)
  };
}

// ============================================
// 3-1) 층별 리더 재고 입력 현황 (오늘)
// ============================================
function getStatus() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ssTz = ss.getSpreadsheetTimeZone();
  const today = todayStr();
  const floors = {};

  FLOORS.forEach(function (floor) {
    const sh = ss.getSheetByName('재고_' + floor);
    let count = 0;
    if (sh) {
      const data = readRecentRows(sh, ssTz, 10);
      const seen = {};
      data.rows.forEach(function (r) {
        if (r.date !== today) return;
        for (let c = 1; c < data.header.length; c++) {
          if (!isBlank(r.cells[c])) seen[normName(data.header[c])] = true;
        }
      });
      count = Object.keys(seen).length;
    }
    floors[floor] = { saved: count > 0, count: count };
  });

  return { ok: true, date: today, floors: floors };
}

// ============================================
// 4) 대표 지시사항 (구글시트 '대표지시' 탭)
// ============================================
function setNotice(req) {
  const auth = pinState('ceo', req.pin);
  if (!auth.ok) return auth;

  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('대표지시');
  if (!sh) return { ok: false, error: 'no 대표지시 sheet' };
  // 맨 위(1행)에 최신 지시 기록: [작성일시, 내용]
  sh.insertRowBefore(1);
  sh.getRange(1, 1, 1, 2).setValues([[new Date(), req.text || '']]);
  return { ok: true };
}

function getNotice() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('대표지시');
  if (!sh || sh.getLastRow() === 0) return { ok: true, text: '', date: '' };
  const row = sh.getRange(1, 1, 1, 2).getValues()[0];
  const dt = row[0] ? Utilities.formatDate(new Date(row[0]), TZ, 'M월 d일') : '';
  return { ok: true, text: row[1] || '', date: dt };
}

// ============================================
// 5) 정리 사본 만들기 — 편집기에서 한 번 실행
//    기존 '재고_2F/3F/4F' 탭은 그대로 두고, 흩어진 열과 중복 행을 합친
//    '정리_재고_2F/3F/4F' 탭을 새로 만든다.
// ============================================
const NAME_ALIASES = { '치즈쁘피': '치즈쁘띠', '레몬케익': '레몬케이크' };

function buildCleanInventoryTabs() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ssTz = ss.getSpreadsheetTimeZone();
  const report = {};

  FLOORS.forEach(function (floor) {
    const src = ss.getSheetByName('재고_' + floor);
    if (!src || src.getLastRow() < 2) { report[floor] = 'no data'; return; }
    const values = src.getDataRange().getValues();
    const built = buildCleanTable(values, ssTz);

    const name = '정리_재고_' + floor;
    let dst = ss.getSheetByName(name);
    if (dst) dst.clear(); else dst = ss.insertSheet(name);
    ensureColumns(dst, built.table[0].length);
    dst.getRange(1, 1, built.table.length, built.table[0].length).setValues(built.table);
    dst.setFrozenRows(1);
    report[floor] = built.stats;
  });

  Logger.log(JSON.stringify(report));
  return report;
}

// values: 원본 탭 전체(1행 = 헤더). 열은 품목명 기준으로, 행은 날짜 기준으로 합친다.
function buildCleanTable(values, ssTz) {
  const header = values[0].map(function (h) { return cleanName(h); });

  // 열 합치기
  const groups = [];            // { key, label, cols: [] }
  const byKey = {};
  for (let c = 1; c < header.length; c++) {
    const own = normName(header[c]);
    if (!own) continue;
    const key = NAME_ALIASES[own] || own;
    const plain = header[c].replace(/^\[추가\]\s*/, '');
    // 대표 이름 우선순위: 정식 품목(3) > [추가] 품목(2) > 오타 별칭(1)
    const rank = own !== key ? 1 : (header[c].indexOf('[추가]') === 0 ? 2 : 3);
    if (!byKey[key]) {
      byKey[key] = { key: key, label: plain, rank: rank, cols: [] };
      groups.push(byKey[key]);
    } else if (rank > byKey[key].rank) {
      byKey[key].label = plain;
      byKey[key].rank = rank;
    }
    byKey[key].cols.push(c);
  }

  // 행 합치기 (같은 날짜는 아래쪽 행의 값이 우선)
  const byDate = {};
  const dates = [];
  let srcRows = 0;
  for (let r = 1; r < values.length; r++) {
    const d = dateKey(values[r][0], ssTz);
    if (!d) continue;
    srcRows++;
    if (!byDate[d]) { byDate[d] = {}; dates.push(d); }
    groups.forEach(function (g) {
      g.cols.forEach(function (c) {
        const v = values[r][c];
        if (!isBlank(v)) byDate[d][g.key] = v;
      });
    });
  }
  dates.sort();

  const table = [['날짜'].concat(groups.map(function (g) { return g.label; }))];
  let kept = 0;
  dates.forEach(function (d) {
    const vals = byDate[d];
    if (!Object.keys(vals).length) return;        // 값이 하나도 없는 날짜는 뺀다
    kept++;
    table.push([d].concat(groups.map(function (g) { return (g.key in vals) ? vals[g.key] : ''; })));
  });

  return {
    table: table,
    stats: { 원본행: srcRows, 정리행: kept, 원본열: header.length - 1, 정리열: groups.length }
  };
}

// ============================================
// 6) 설정 점검 — 편집기에서 실행하면 빠진 설정을 알려준다
// ============================================
function setupCheck() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const out = {
    'NOTION_TOKEN 설정': !!prop('NOTION_TOKEN'),
    'CEO_PIN 설정': !!prop('CEO_PIN'),
    'SUPERVISOR_PIN 설정': !!prop('SUPERVISOR_PIN'),
    '재고_2F 탭': !!ss.getSheetByName('재고_2F'),
    '재고_3F 탭': !!ss.getSheetByName('재고_3F'),
    '재고_4F 탭': !!ss.getSheetByName('재고_4F'),
    '대표지시 탭': !!ss.getSheetByName('대표지시')
  };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
