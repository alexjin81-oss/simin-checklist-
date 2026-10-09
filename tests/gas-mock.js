// Apps Script 코드를 Node에서 돌려 보기 위한 최소 모의 환경.
// 실제 시트처럼 'yyyy-MM-dd' 글자를 날짜 값으로 바꿔 저장한다(원래 버그의 원인).
const fs = require('fs');
const vm = require('vm');

function makeClock(iso) {
  const clock = { now: new Date(iso).getTime() };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(clock.now); else super(...args);
    }
    static now() { return clock.now; }
  }
  clock.Date = FakeDate;
  clock.set = (s) => { clock.now = new RealDate(s).getTime(); };
  return clock;
}

function formatDate(date, tz, fmt) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date).reduce((a, p) => (a[p.type] = p.value, a), {});
  const hour = parts.hour === '24' ? '00' : parts.hour;
  if (fmt === 'yyyy-MM-dd') return `${parts.year}-${parts.month}-${parts.day}`;
  if (fmt === 'HH:mm') return `${hour}:${parts.minute}`;
  if (fmt === 'M월 d일') return `${Number(parts.month)}월 ${Number(parts.day)}일`;
  throw new Error('unsupported format ' + fmt);
}

class Sheet {
  constructor(name, tz, DateCtor, maxCols = 26) {
    this.name = name; this.tz = tz; this.D = DateCtor;
    this.rows = []; this.maxCols = maxCols; this.frozen = 0;
  }
  // 시트의 자동 변환 흉내: 날짜처럼 생긴 글자는 날짜 값이 된다
  coerce(v) {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return new this.D(v + 'T00:00:00+09:00');
    }
    return v;
  }
  getLastRow() {
    for (let r = this.rows.length - 1; r >= 0; r--) {
      if (this.rows[r].some(v => v !== '' && v !== null && v !== undefined)) return r + 1;
    }
    return 0;
  }
  getLastColumn() {
    let m = 0;
    this.rows.forEach(r => r.forEach((v, i) => { if (v !== '' && v !== null && v !== undefined) m = Math.max(m, i + 1); }));
    return m;
  }
  getMaxColumns() { return this.maxCols; }
  insertColumnsAfter(after, n) { this.maxCols += n; }
  insertRowBefore(n) { this.rows.splice(n - 1, 0, []); }
  setFrozenRows(n) { this.frozen = n; }
  clear() { this.rows = []; }
  appendRow(row) {
    if (row.length > this.maxCols) this.maxCols = row.length;   // appendRow는 열을 늘려 준다
    const at = this.getLastRow();
    this.rows[at] = row.map(v => this.coerce(v));
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1));
  }
  getRange(r, c, nr = 1, nc = 1) {
    const sh = this;
    if (c + nc - 1 > sh.maxCols) throw new Error('범위의 좌표가 시트의 크기를 벗어났습니다 (' + sh.name + ')');
    return {
      getValues() {
        const out = [];
        for (let i = 0; i < nr; i++) {
          const row = [];
          for (let j = 0; j < nc; j++) {
            const v = (sh.rows[r - 1 + i] || [])[c - 1 + j];
            row.push(v === undefined || v === null ? '' : v);
          }
          out.push(row);
        }
        return out;
      },
      setValues(vals) {
        vals.forEach((row, i) => {
          sh.rows[r - 1 + i] = sh.rows[r - 1 + i] || [];
          row.forEach((v, j) => { sh.rows[r - 1 + i][c - 1 + j] = sh.coerce(v); });
        });
      },
      setValue(v) { this.setValues([[v]]); }
    };
  }
}

class Spreadsheet {
  constructor(tz, DateCtor) { this.tz = tz; this.D = DateCtor; this.sheets = {}; }
  add(name, maxCols) { return (this.sheets[name] = new Sheet(name, this.tz, this.D, maxCols)); }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return this.add(n); }
  getSpreadsheetTimeZone() { return this.tz; }
}

function loadScript(file, { nowIso, props = {}, fetchHandler } = {}) {
  const clock = makeClock(nowIso || '2026-10-09T10:00:00+09:00');
  const ss = new Spreadsheet('Asia/Seoul', clock.Date);
  const cache = {};
  const fetchLog = [];
  const ctx = {
    Date: clock.Date, JSON, Math, Number, String, Object, Array, isNaN, console,
    Logger: { log() {} },
    Utilities: { formatDate },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null) }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ text: s, setMimeType() { return this; } })
    },
    UrlFetchApp: {
      fetch(url, opt) {
        fetchLog.push({ url, opt });
        const r = fetchHandler ? fetchHandler(url, opt) : { code: 200, body: '{}' };
        return { getResponseCode: () => r.code, getContentText: () => r.body };
      }
    }
  };
  vm.createContext(ctx);
  // 최상위 const/function 을 컨텍스트에서 꺼내 쓸 수 있게 var 로 바꿔 실행한다
  const src = fs.readFileSync(file, 'utf8').replace(/^const /gm, 'var ');
  vm.runInContext(src, ctx, { filename: file });
  const call = (payload) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(payload) } }).text);
  return { ctx, ss, clock, props, cache, fetchLog, call };
}

module.exports = { loadScript, formatDate };
