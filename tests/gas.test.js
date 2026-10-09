const assert = require('assert');
const path = require('path');
const { loadScript } = require('./gas-mock');

const MANAGE = path.join(__dirname, '..', 'apps-script', 'manage-api.gs');
const PROD = path.join(__dirname, '..', 'apps-script', 'production-api.gs');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name + '\n    ' + (e.stack || e)); process.exitCode = 1; }
}
const dstr = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);

function manageEnv(opts = {}) {
  const env = loadScript(MANAGE, opts);
  ['재고_2F', '재고_3F', '재고_4F', '대표지시'].forEach(n => env.ss.add(n));
  return env;
}

console.log('관리시스템 API');

test('같은 날 두 번 저장해도 한 줄만 남는다 (날짜 칸이 날짜 형식이어도)', () => {
  const env = manageEnv();
  const sh = env.ss.sheets['재고_3F'];
  sh.appendRow(['날짜', '생도너츠', '찹쌀도너츠']);
  sh.appendRow(['2026-10-08', 150, 450]);
  assert.ok(sh.rows[1][0] instanceof Date, '모의 시트가 날짜로 변환해야 함');

  let r = env.call({ action: 'saveInventory', floor: '3F', items: { '생도너츠': 120 } });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.overwritten, false);
  r = env.call({ action: 'saveInventory', floor: '3F', items: { '찹쌀도너츠': 300 } });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.overwritten, true);
  r = env.call({ action: 'saveInventory', floor: '3F', items: { '생도너츠': 110 } });

  assert.strictEqual(sh.getLastRow(), 3, '헤더 + 어제 + 오늘 = 3행');
  assert.deepStrictEqual([dstr(sh.rows[2][0]), sh.rows[2][1], sh.rows[2][2]], ['2026-10-09', 110, 300]);
});

test('예전 중복 행이 있으면 가장 아래 오늘 행을 고친다', () => {
  const env = manageEnv();
  const sh = env.ss.sheets['재고_4F'];
  sh.appendRow(['날짜', '소금빵']);
  sh.appendRow(['2026-10-09', 100]);
  sh.appendRow(['2026-10-09', 200]);
  env.call({ action: 'saveInventory', floor: '4F', items: { '소금빵': 300 } });
  assert.strictEqual(sh.getLastRow(), 3);
  assert.strictEqual(sh.rows[1][1], 100);
  assert.strictEqual(sh.rows[2][1], 300);
});

test('다음 날에는 새 줄이 생긴다', () => {
  const env = manageEnv();
  const sh = env.ss.sheets['재고_4F'];
  env.call({ action: 'saveInventory', floor: '4F', items: { '소금빵': 300 } });
  env.clock.set('2026-10-10T07:30:00+09:00');
  env.call({ action: 'saveInventory', floor: '4F', items: { '소금빵': 250 } });
  assert.strictEqual(sh.getLastRow(), 3);
  assert.deepStrictEqual(sh.rows[0], ['날짜', '소금빵']);
});

test('자정 직후(한국 시간)도 한국 날짜로 저장된다', () => {
  const env = manageEnv({ nowIso: '2026-10-10T00:20:00+09:00' });   // UTC로는 아직 10/9
  const r = env.call({ action: 'saveInventory', floor: '2F', items: { '우유롤': 10 } });
  assert.strictEqual(r.date, '2026-10-10');
});

test('띄어쓰기·[추가]만 다른 품목은 기존 열에 들어가고 새 열이 생기지 않는다', () => {
  const env = manageEnv();
  const sh = env.ss.sheets['재고_2F'];
  sh.appendRow(['날짜', '초코마들렌', '[추가] 레몬케이크']);
  env.call({ action: 'saveInventory', floor: '2F', items: {
    '[추가] 초코 마들렌': 900, '레몬케이크': 40, '[추가]  레몬 케이크': 41, '[추가] 까눌레': 12 } });
  assert.deepStrictEqual(sh.rows[0], ['날짜', '초코마들렌', '[추가] 레몬케이크', '[추가] 까눌레']);
  assert.strictEqual(sh.rows[1][1], 900);
  assert.strictEqual(sh.rows[1][2], 41);
  assert.strictEqual(sh.rows[1][3], 12);
});

test('정식 품목 열과 [추가] 열이 둘 다 있으면 정식 열을 쓴다', () => {
  const env = manageEnv();
  const sh = env.ss.sheets['재고_2F'];
  sh.appendRow(['날짜', '[추가] 초코마들렌', '초코마들렌']);
  env.call({ action: 'saveInventory', floor: '2F', items: { '[추가] 초코 마들렌': 5 } });
  assert.strictEqual(sh.rows[1][2], 5);
  assert.ok(sh.rows[1][1] === '' || sh.rows[1][1] === undefined);
});

test('입력한 품목이 없으면 저장하지 않는다 (빈 행 방지)', () => {
  const env = manageEnv();
  const sh = env.ss.sheets['재고_3F'];
  sh.appendRow(['날짜', '생도너츠']);
  const r = env.call({ action: 'saveInventory', floor: '3F', items: { '생도너츠': '', '소보로': null } });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(sh.getLastRow(), 1);
});

test('열이 시트 너비를 넘어가도 저장된다', () => {
  const env = manageEnv();
  const sh = env.ss.add('재고_3F', 3);
  sh.appendRow(['날짜', 'A', 'B']);
  const r = env.call({ action: 'saveInventory', floor: '3F', items: { 'C': 1, 'D': 2, 'E': 3 } });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.deepStrictEqual(sh.rows[0], ['날짜', 'A', 'B', 'C', 'D', 'E']);
  // 같은 날 다시 저장(기존 행 읽기)도 통과
  assert.strictEqual(env.call({ action: 'saveInventory', floor: '3F', items: { 'F': 9 } }).ok, true);
});

test('알 수 없는 층은 거절한다', () => {
  const env = manageEnv();
  assert.strictEqual(env.call({ action: 'saveInventory', floor: '5F', items: { a: 1 } }).ok, false);
  assert.strictEqual(env.call({ action: 'getInventory', floor: '' }).ok, false);
});

test('"어제 재고"는 오늘 이전의 실제 값만 준다 (오늘 값·빈 행·오래된 값 제외)', () => {
  const env = manageEnv();
  const sh = env.ss.sheets['재고_3F'];
  sh.appendRow(['날짜', '생도너츠', '찹쌀도너츠', '소보로', '모카빵']);
  sh.appendRow(['2026-09-01', 999, 999, 999, 77]);      // 2주 넘은 값
  sh.appendRow(['2026-10-07', 150, 450, '', '']);
  sh.appendRow(['2026-10-08', 120, '', 60, '']);
  sh.appendRow(['2026-10-08', '', '', '', '']);         // 예전 방식이 남긴 빈 행
  sh.appendRow(['2026-10-09', 100, '', '', '']);        // 오늘 이미 저장한 값
  const r = env.call({ action: 'getInventory', floor: '3F' });
  assert.deepStrictEqual(r.prev['생도너츠'], { v: 120, d: '2026-10-08' });
  assert.deepStrictEqual(r.prev['찹쌀도너츠'], { v: 450, d: '2026-10-07' });
  assert.deepStrictEqual(r.prev['소보로'], { v: 60, d: '2026-10-08' });
  assert.strictEqual(r.prev['모카빵'], undefined);
  assert.deepStrictEqual(r.today, { '생도너츠': 100 });
  assert.strictEqual(r.todaySaved, true);
  assert.strictEqual(r.yesterday, '2026-10-08');
  assert.strictEqual(r.items['생도너츠'], 120, '구버전 화면 호환 필드');
});

test('시트가 비어 있어도 읽기가 실패하지 않는다', () => {
  const env = manageEnv();
  const r = env.call({ action: 'getInventory', floor: '2F' });
  assert.strictEqual(r.ok, true); assert.deepStrictEqual(r.prev, {}); assert.strictEqual(r.todaySaved, false);
});

test('층별 입력 현황이 실제 저장 여부를 반영한다', () => {
  const env = manageEnv();
  env.ss.sheets['재고_2F'].appendRow(['날짜', '우유롤', '쌀롤']);
  env.ss.sheets['재고_2F'].appendRow(['2026-10-08', 5, 5]);
  env.ss.sheets['재고_4F'].appendRow(['날짜', '소금빵', '크로와상', '몽블랑']);
  env.call({ action: 'saveInventory', floor: '4F', items: { '소금빵': 300, '크로와상': 100 } });
  const r = env.call({ action: 'getStatus' });
  assert.deepStrictEqual(r.floors, {
    '2F': { saved: false, count: 0 }, '3F': { saved: false, count: 0 }, '4F': { saved: true, count: 2 } });
});

test('PIN: 미설정 → 거절, 틀림 → 거절, 5회 틀리면 잠김, 맞으면 통과', () => {
  let env = manageEnv();
  let r = env.call({ action: 'checkPin', role: 'ceo', pin: '1234' });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.unset, true);

  env = manageEnv({ props: { CEO_PIN: '7391', SUPERVISOR_PIN: '4826' } });
  assert.strictEqual(env.call({ action: 'checkPin', role: 'ceo', pin: '7391' }).ok, true);
  assert.strictEqual(env.call({ action: 'checkPin', role: 'supervisor', pin: '7391' }).ok, false);
  assert.strictEqual(env.call({ action: 'checkPin', role: 'nobody', pin: '7391' }).ok, false);
  for (let i = 0; i < 5; i++) env.call({ action: 'checkPin', role: 'ceo', pin: '0000' });
  r = env.call({ action: 'checkPin', role: 'ceo', pin: '7391' });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.locked, true);
});

test('대표 지시사항은 PIN 없이는 저장되지 않는다', () => {
  const env = manageEnv({ props: { CEO_PIN: '7391' } });
  const sh = env.ss.sheets['대표지시'];
  assert.strictEqual(env.call({ action: 'setNotice', text: '몰래 수정' }).ok, false);
  assert.strictEqual(sh.getLastRow(), 0);
  assert.strictEqual(env.call({ action: 'setNotice', text: '토요일 시트 2배', pin: '7391' }).ok, true);
  const n = env.call({ action: 'getNotice' });
  assert.strictEqual(n.text, '토요일 시트 2배'); assert.strictEqual(n.date, '10월 9일');
});

test('점검 저장: 토큰이 없으면 명확한 오류, 코드에 토큰이 없다', () => {
  const env = manageEnv({ props: { SUPERVISOR_PIN: '4826' } });
  const r = env.call({ action: 'saveSupervisor', pin: '4826', data: {} });
  assert.strictEqual(r.ok, false); assert.ok(/NOTION_TOKEN/.test(r.error));
  assert.strictEqual(env.fetchLog.length, 0);
  const src = require('fs').readFileSync(MANAGE, 'utf8');
  assert.ok(!/ntn_[A-Za-z0-9]{10,}|secret_[A-Za-z0-9]{10,}/.test(src), '코드에 토큰 문자열이 있으면 안 됨');
});

test('점검 저장: 오늘 기록이 없으면 새로 만들고, 있으면 그 기록을 고친다', () => {
  let existing = '';
  const env = manageEnv({
    props: { SUPERVISOR_PIN: '4826', NOTION_TOKEN: 'test-token' },
    fetchHandler: (url) => {
      if (/\/query$/.test(url)) return { code: 200, body: JSON.stringify({ results: existing ? [{ id: existing }] : [] }) };
      return { code: 200, body: '{}' };
    }
  });
  assert.strictEqual(env.call({ action: 'saveSupervisor', data: { s1: true } }).ok, false, 'PIN 필수');

  let r = env.call({ action: 'saveSupervisor', pin: '4826', data: { s1: true, bang: '4', status: 'draft' } });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.updated, false); assert.strictEqual(r.draft, true);
  let last = env.fetchLog[env.fetchLog.length - 1];
  assert.strictEqual(last.opt.method, 'post'); assert.ok(/\/v1\/pages$/.test(last.url));
  let body = JSON.parse(last.opt.payload);
  assert.strictEqual(body.parent.database_id, '6369a579-c16c-40b0-8221-0a06d6f32e6c');
  assert.strictEqual(body.properties['상태'].select.name, '📝 작성중');
  assert.strictEqual(body.properties['빵앙금(박스)'].number, 4);
  assert.strictEqual(body.properties['작성일'].date.start, '2026-10-09');
  assert.strictEqual(last.opt.headers.Authorization, 'Bearer test-token');

  existing = 'page-123';
  r = env.call({ action: 'saveSupervisor', pin: '4826', data: { s1: true, plan: true } });
  assert.strictEqual(r.updated, true);
  last = env.fetchLog[env.fetchLog.length - 1];
  assert.strictEqual(last.opt.method, 'patch'); assert.ok(/\/v1\/pages\/page-123$/.test(last.url));
  assert.strictEqual(JSON.parse(last.opt.payload).properties['상태'].select.name, '✅ 작성완료');
});

test('점검 저장: 노션 속성 이름이 실제 DB와 같다', () => {
  const env = manageEnv({ props: { SUPERVISOR_PIN: '4826', NOTION_TOKEN: 't' } });
  env.call({ action: 'saveSupervisor', pin: '4826', data: {} });
  const sent = Object.keys(JSON.parse(env.fetchLog[env.fetchLog.length - 1].opt.payload).properties).sort();
  const schema = ['2F 메모', '2F 워크인 확인', '3F 메모', '3F 워크인 확인', '4F 메모', '4F 워크인 확인',
    '공장 위생 점검', '날짜', '떡앙금(박스)', '버터(kg)', '빵앙금(박스)', '사전예약 수량', '상태', '생크림(통)',
    '오늘 코멘트', '위생 메모', '익일 생산계획', '작성일', '전날 폐기 확인', '조회 진행', '주요 제품 품질 확인',
    '중요·대량 예약건', '폐기 메모', '품질 확인 메모'].sort();
  assert.deepStrictEqual(sent, schema);
});

test('정리 사본: 흩어진 열과 중복·빈 행을 합친다 (원본은 그대로)', () => {
  const env = manageEnv();
  const sh = env.ss.sheets['재고_2F'];
  sh.maxCols = 40;
  sh.appendRow(['날짜', '화이트시트 미니', '치즈쁘피', '[추가] 초코 마들렌', '[추가] 초코마들렌', '치즈 쁘띠', '초코마들렌']);
  sh.appendRow(['2026-06-18', '', '', '', '', '', '']);
  sh.appendRow(['2026-06-18', 48, 49, 1025, '', '', '']);
  sh.appendRow(['2026-06-19', 86, 49, '', 989, '', '']);
  sh.appendRow(['2026-06-19', 86, 49, '', 989, '', '']);
  sh.appendRow(['2026-06-20', 79, '', '', '', 47, 969]);
  sh.appendRow(['2026-06-23', '', '', '', '', '', '']);
  const before = JSON.stringify(sh.rows);

  const report = env.ctx.buildCleanInventoryTabs();
  assert.strictEqual(JSON.stringify(sh.rows), before, '원본 탭은 바뀌지 않아야 함');
  const out = env.ss.sheets['정리_재고_2F'];
  assert.deepStrictEqual(out.rows[0], ['날짜', '화이트시트 미니', '치즈 쁘띠', '초코마들렌']);
  const body = out.rows.slice(1).map(r => [dstr(r[0]), r[1], r[2], r[3]]);
  assert.deepStrictEqual(body, [
    ['2026-06-18', 48, 49, 1025], ['2026-06-19', 86, 49, 989], ['2026-06-20', 79, 47, 969]]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(report['2F'])), { 원본행: 6, 정리행: 3, 원본열: 6, 정리열: 3 });
});

console.log('생산기록 API');

function prodEnv(opts = {}) {
  const env = loadScript(PROD, opts);
  const staff = env.ss.add('직원명단');
  staff.appendRow(['이름', 'PIN', '매장', '기본층', '활성여부']);
  staff.appendRow(['김본점', '1111', '본점', '3층', true]);
  staff.appendRow(['이효자', '2222', '효자강변점', '', 'TRUE']);
  staff.appendRow(['퇴사자', '3333', '본점', '3층', false]);
  env.ss.add('생산기록').appendRow(['타임스탬프', '날짜', '작성자', '매장', '층/구역', '시간대', '작업내용', '폐기내용', '폐기사유']);
  return env;
}

test('기록 날짜: 기본은 오늘, 어제를 고르면 어제로, 그 밖의 날짜는 오늘로', () => {
  const env = prodEnv({ nowIso: '2026-10-09T08:10:00+09:00' });
  const sh = env.ss.sheets['생산기록'];
  const base = { action: 'submit', name: '김본점', store: '본점', floor: '3층', period: '오후', work: '[도넛] 생도너츠 100개' };
  assert.strictEqual(env.call(base).date, '2026-10-09');
  assert.strictEqual(env.call(Object.assign({ recordDate: '2026-10-08' }, base)).date, '2026-10-08');
  assert.strictEqual(env.call(Object.assign({ recordDate: '2026-10-01' }, base)).date, '2026-10-09');
  assert.strictEqual(env.call(Object.assign({ recordDate: '2026-10-10' }, base)).date, '2026-10-09');
  assert.strictEqual(sh.getLastRow(), 5);
});

test('기록 조회: 어제로 올린 기록은 어제 목록에 나오고 "다음 날 입력" 표시가 붙는다', () => {
  const env = prodEnv({ nowIso: '2026-10-09T08:10:00+09:00' });
  const base = { action: 'submit', name: '김본점', store: '본점', floor: '3층', period: '오후', work: 'w' };
  env.call(Object.assign({ recordDate: '2026-10-08' }, base));
  env.call(base);
  const y = env.call({ action: 'getRecords', range: 'yesterday' }).records;
  const t = env.call({ action: 'getRecords', range: 'today' }).records;
  assert.strictEqual(y.length, 1); assert.strictEqual(y[0].late, true); assert.strictEqual(y[0].timeStr, '08:10');
  assert.strictEqual(t.length, 1); assert.strictEqual(t[0].late, false);
  assert.strictEqual(env.call({ action: 'getRecords', range: 'week' }).records.length, 2);
});

test('매장 이름: 예전 "효자점" 기록도 "효자강변점"으로 보인다', () => {
  const env = prodEnv();
  env.call({ action: 'submit', name: '이효자', store: '효자점', floor: '생산실', period: '오전', work: 'w' });
  assert.strictEqual(env.ss.sheets['생산기록'].rows[1][3], '효자강변점');
  env.ss.sheets['생산기록'].appendRow([new Date('2026-10-09T09:00:00+09:00'), '2026-10-09', '이효자', '효자점', '생산실', '오전', 'old', '', '']);
  const recs = env.call({ action: 'getRecords', range: 'today' }).records;
  assert.deepStrictEqual(recs.map(r => r.store), ['효자강변점', '효자강변점']);
});

test('로그인·직원 목록은 그대로 동작한다', () => {
  const env = prodEnv();
  assert.strictEqual(env.call({ action: 'login', name: '김본점', pin: '1111' }).ok, true);
  assert.strictEqual(env.call({ action: 'login', name: '김본점', pin: '9999' }).ok, false);
  assert.strictEqual(env.call({ action: 'login', name: '퇴사자', pin: '3333' }).ok, false);
  const l = env.call({ action: 'getStaffList' }).list;
  assert.deepStrictEqual(l.map(s => s.name), ['김본점', '이효자']);
  assert.strictEqual(l[1].store, '효자강변점');
});

console.log('\n통과 ' + passed + '건' + (process.exitCode ? ' · 실패 있음' : ''));
