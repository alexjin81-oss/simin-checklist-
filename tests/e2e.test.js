// 화면(production.html, manage.html)을 실제 브라우저로 열고,
// 서버 호출은 Apps Script 코드를 모의 시트 위에서 그대로 돌려 응답한다.
// 실행: NODE_PATH=/opt/npm-tools/node_modules node tests/e2e.test.js [스크린샷 폴더]
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');
const { loadScript } = require('./gas-mock');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'simin-clean', 'public');
const SHOTS = process.argv[2] || path.join(ROOT, 'tests', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const kst = (off = 0) => new Date(Date.now() + 9 * 3600e3 - off * 86400e3).toISOString().slice(0, 10);
const TODAY = kst(0), YDAY = kst(1);
const dkey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);

let passed = 0, failed = 0;
async function step(name, fn) {
  try { await fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + String(e.stack || e).split('\n').slice(0, 6).join('\n    ')); }
}

function backends() {
  const nowIso = new Date().toISOString();
  const prod = loadScript(path.join(ROOT, 'apps-script', 'production-api.gs'), { nowIso });
  const staff = prod.ss.add('직원명단');
  staff.appendRow(['이름', 'PIN', '매장', '기본층', '활성여부']);
  staff.appendRow(['김삼층', '1111', '본점', '3층', true]);
  staff.appendRow(['박사층', '1111', '본점', '4층', true]);
  staff.appendRow(['이효자', '2222', '효자강변점', '', true]);
  prod.ss.add('생산기록').appendRow(['타임스탬프', '날짜', '작성자', '매장', '층/구역', '시간대', '작업내용', '폐기내용', '폐기사유']);

  const notion = { todayPage: '' };
  const manage = loadScript(path.join(ROOT, 'apps-script', 'manage-api.gs'), {
    nowIso,
    props: { CEO_PIN: '7391', SUPERVISOR_PIN: '4826', NOTION_TOKEN: 'test-token' },
    fetchHandler: (url, opt) => {
      if (/\/query$/.test(url)) return { code: 200, body: JSON.stringify({ results: notion.todayPage ? [{ id: notion.todayPage }] : [] }) };
      if (opt.method === 'post') notion.todayPage = 'page-1';
      return { code: 200, body: '{}' };
    }
  });
  ['재고_2F', '재고_4F', '대표지시'].forEach(n => manage.ss.add(n));
  // 3층: 예전 방식이 남긴 데이터 모양(날짜 값, 중복 행, 빈 행)
  const s3 = manage.ss.add('재고_3F', 40);
  s3.appendRow(['날짜', '생도너츠', '찹쌀도너츠', '밤만쥬', '통밀만쥬', '파이만쥬', '한입만쥬', '몽블랑', '소금빵']);
  s3.appendRow([kst(2), 180, 400, 70, 90, 230, 1500, 33, 85]);
  s3.appendRow([YDAY, 150, 450, 60, 90, 230, 1500, '', '']);
  s3.appendRow([YDAY, 150, 450, 60, 90, 230, 1500, '', '']);
  s3.appendRow([YDAY, '', '', '', '', '', '', '', '']);
  return { prod, manage, notion };
}

(async () => {
  const be = backends();
  const server = http.createServer((req, res) => {
    const file = path.join(PUB, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': file.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(file));
  }).listen(0);
  const base = 'http://127.0.0.1:' + server.address().port;

  const browser = await chromium.launch();
  const errors = [];
  async function newPage(width = 390, tz = 'Asia/Seoul') {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, timezoneId: tz, locale: 'ko-KR' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
    await page.route('https://script.google.com/**', async route => {
      const url = route.request().url();
      const env = url.includes('AKfycbxKJWb8') ? be.prod : be.manage;
      const body = env.call(JSON.parse(route.request().postData()));
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    });
    return page;
  }
  const shot = async (page, name, full = false) => {
    // 안내 문구(토스트)가 사라진 뒤에 찍는다
    await page.waitForFunction(() => !document.getElementById('toast').classList.contains('show'), null, { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(350);
    return page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: full });
  };
  const noOverflow = async (page) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '가로 스크롤 발생');
  const toastText = (page) => page.locator('#toast').innerText();

  // ================= 생산기록 =================
  console.log('생산기록 화면');
  const records = be.prod.ss.sheets['생산기록'];
  let p = await newPage();
  await p.goto(base + '/production.html');

  await step('로그인 → 기본 층 색(3층)과 오늘 날짜가 선택된다', async () => {
    await p.selectOption('#loginName', '김삼층');
    await p.fill('#loginPin', '1111');
    await p.click('#loginBtn');
    await p.waitForSelector('#mainView:not(.hidden)');
    assert.strictEqual(await p.evaluate(() => document.body.dataset.floor), '3층');
    assert.ok(await p.locator('#dateSeg button[data-val="today"]').evaluate(e => e.classList.contains('active')));
    await noOverflow(p);
  });

  await step('작업 입력 후 "어제"로 저장하면 어제 날짜로 기록되고 다시 오늘로 돌아온다', async () => {
    const card = p.locator('.work-card').first();
    await card.locator('.category-select').selectOption('도넛');
    await card.locator('.task-select').selectOption('생도너츠');
    await card.locator('.quantity').fill('1350');
    await p.click('#dateSeg button[data-val="yesterday"]');
    assert.ok(await p.locator('#lateNote').isVisible());
    await shot(p, '01-생산기록-입력', true);
    await p.click('#submitBtn');
    await p.waitForFunction(() => document.getElementById('toast').classList.contains('show'));
    assert.ok(/어제/.test(await toastText(p)), await toastText(p));
    const row = records.rows[1];
    assert.strictEqual(dkey(row[1]), YDAY);
    assert.strictEqual(row[3], '본점'); assert.strictEqual(row[4], '3층');
    assert.strictEqual(row[6], '[도넛] 생도너츠 1350개');
    assert.ok(await p.locator('#dateSeg button[data-val="today"]').evaluate(e => e.classList.contains('active')));
    assert.ok(!(await p.locator('#lateNote').isVisible()));
  });

  await step('오늘 기록 저장 + 층을 바꾸면 화면 색이 바뀐다', async () => {
    await p.click('#floorSeg button[data-val="4층"]');
    assert.strictEqual(await p.evaluate(() => document.body.dataset.floor), '4층');
    await p.waitForFunction(() => getComputedStyle(document.body).borderTopColor === 'rgb(58, 108, 142)', null, { timeout: 3000 });
    const card = p.locator('.work-card').first();
    await card.locator('.category-select').selectOption('레옹기');
    await card.locator('.task-select').selectOption('단팥빵');
    await card.locator('.quantity').fill('600');
    await p.fill('#waste', '단팥빵 4개');
    await p.click('#reasonChecks input[value="굽기실패"]');
    await p.click('#submitBtn');
    await p.waitForFunction(() => /기록 완료/.test(document.getElementById('toast').textContent));
    assert.strictEqual(dkey(records.rows[2][1]), TODAY);
    assert.strictEqual(records.getLastRow(), 3);
  });

  await step('기록 보기: 어제 기록에 "다음 날 입력" 표시, 층 색 태그', async () => {
    await p.click('#tabView');
    await p.waitForSelector('.record-card');
    assert.strictEqual(await p.locator('.record-card').count(), 1);
    await p.click('#rangeFilter button[data-val="yesterday"]');
    await p.waitForFunction(() => /다음 날 입력/.test(document.getElementById('recordList').textContent));
    await p.click('#rangeFilter button[data-val="week"]');
    await p.waitForFunction(() => document.querySelectorAll('.record-card').length === 2);
    await shot(p, '02-생산기록-보기', true);
    await noOverflow(p);
  });

  await step('효자강변점 직원: 매장·구역이 자동 선택되고 바로 직접 입력할 수 있다', async () => {
    const q = await newPage();
    await q.goto(base + '/production.html');
    await q.selectOption('#loginName', '이효자');
    await q.fill('#loginPin', '2222');
    await q.click('#loginBtn');
    await q.waitForSelector('#mainView:not(.hidden)');
    assert.ok(await q.locator('#storeSeg button[data-val="효자강변점"]').evaluate(e => e.classList.contains('active')));
    assert.ok(await q.locator('#floorSeg button[data-val="생산실"]').evaluate(e => e.classList.contains('active')));
    assert.ok(await q.locator('.work-card .task-custom').first().isVisible());
    await q.locator('.work-card .task-custom').first().fill('사워도우');
    await q.locator('.work-card .quantity').first().fill('40');
    await shot(q, '03-생산기록-효자강변점', true);
    await q.click('#submitBtn');
    await q.waitForFunction(() => /기록 완료/.test(document.getElementById('toast').textContent));
    const row = records.rows[3];
    assert.strictEqual(row[3], '효자강변점'); assert.strictEqual(row[4], '생산실');
    assert.strictEqual(row[6], '[직접 입력] 사워도우 40개');
    await q.context().close();
  });

  await step('기기 시간대가 달라도 한국 날짜로 보낸다', async () => {
    const q = await newPage(390, 'America/Los_Angeles');
    await q.goto(base + '/production.html');
    const got = await q.evaluate(() => [kstDay(0).iso, kstDay(1).iso]);
    assert.deepStrictEqual(got, [TODAY, YDAY]);
    await q.context().close();
  });
  await p.context().close();

  // ================= 관리 화면 =================
  console.log('관리 화면');
  const s3 = be.manage.ss.sheets['재고_3F'];
  let m = await newPage();
  await m.goto(base + '/manage.html');
  await shot(m, '04-관리-역할선택');

  await step('3F 재고: 칸은 비어 있고 어제 값은 참고로만 보인다 (예시 숫자 없음)', async () => {
    await m.click('button[data-floor="3F"]');
    await m.waitForSelector('#inv-sdonut');
    assert.strictEqual(await m.inputValue('#in-sdonut'), '');
    assert.ok(/어제 150/.test(await m.locator('#inv-sdonut .prev').innerText()));
    // 몽블랑·소금빵은 어제 값이 없고 그제 값만 있음 → 날짜로 표시
    assert.ok(/\d+\/\d+ 33/.test(await m.locator('#inv-mongblanc .prev').innerText()), await m.locator('#inv-mongblanc .prev').innerText());
    // 기록이 전혀 없는 품목은 "같음"을 누를 수 없다
    assert.ok(/이전 기록 없음/.test(await m.locator('#inv-shake .prev').innerText()));
    assert.ok(await m.locator('#same-shake').isDisabled());
    const filled = await m.evaluate(() => Array.from(document.querySelectorAll('.inv-row input')).filter(i => i.value !== '').length);
    assert.strictEqual(filled, 0);
    assert.ok(/0 \/ 24/.test(await m.locator('#progressLabel').innerText()));
    await noOverflow(m);
  });

  await step('큰 차이가 나는 숫자는 확인을 거쳐야 저장된다', async () => {
    await m.fill('#in-sdonut', '15800');
    await m.locator('#in-sdonut').blur();
    await m.waitForSelector('#warn-sdonut:not(.hidden)');
    assert.ok(/어제 150 → 오늘 15,800/.test(await m.locator('#warn-sdonut').innerText()));
    assert.strictEqual(await m.locator('#in-sdonut').evaluate(e => e.scrollWidth <= e.clientWidth), true, '5자리 숫자가 칸에서 잘림');
    await m.click('#submitBtn');
    assert.ok(/확인이 필요한 숫자가 1개/.test(await toastText(m)));
    assert.strictEqual(s3.getLastRow(), 5, '저장되면 안 됨');
    await shot(m, '05-재고-숫자확인');
    await m.click('#warn-sdonut button:nth-of-type(2)');           // 다시 입력
    assert.strictEqual(await m.inputValue('#in-sdonut'), '');
    await m.fill('#in-sdonut', '140');
    await m.locator('#in-sdonut').blur();
    assert.ok(!(await m.locator('#warn-sdonut').isVisible()));
  });

  await step('"같음", 긴급 표시, 목록에 없는 품목 → 입력한 것만 오늘 한 줄로 저장', async () => {
    await m.click('#same-cdonut');                                   // 찹쌀도너츠 = 어제 450
    assert.strictEqual(await m.inputValue('#in-cdonut'), '450');
    await m.fill('#in-bammanju', '20');                              // 안전재고 50 미만 → 긴급
    await m.locator('#in-bammanju').blur();
    assert.ok(/긴급/.test(await m.locator('#st-bammanju').innerText()));
    await m.click('.add-btn');
    await m.locator('#extraBox input[type=text]').fill('신제품  A');
    await m.locator('#extraBox input[type=number]').fill('5');
    assert.ok(/3 \/ 24/.test(await m.locator('#progressLabel').innerText()));
    await shot(m, '06-재고-입력중', true);
    await m.click('#submitBtn');
    await m.waitForFunction(() => /개 저장/.test(document.getElementById('toast').textContent));
    assert.ok(/4개 저장 · 긴급 1개 · 미입력 21개/.test(await toastText(m)), await toastText(m));

    assert.strictEqual(s3.getLastRow(), 6, '오늘 행 1개만 추가');
    const head = s3.rows[0], row = s3.rows[5];
    const val = n => row[head.indexOf(n)];
    assert.strictEqual(dkey(row[0]), TODAY);
    assert.strictEqual(val('생도너츠'), 140); assert.strictEqual(val('찹쌀도너츠'), 450); assert.strictEqual(val('밤만쥬'), 20);
    assert.strictEqual(val('[추가] 신제품 A'), 5);
    ['통밀만쥬', '파이만쥬', '한입만쥬', '몽블랑', '소금빵'].forEach(n => assert.ok(val(n) === '' || val(n) === undefined, n + ' 는 비어 있어야 함'));
  });

  await step('다시 들어오면 오늘 저장한 값이 보이고, 고쳐서 저장해도 줄이 늘지 않는다', async () => {
    await m.reload();
    await m.click('button[data-floor="3F"]');
    await m.waitForSelector('#inv-sdonut');
    assert.strictEqual(await m.inputValue('#in-sdonut'), '140');
    assert.strictEqual(await m.inputValue('#in-tmp', { timeout: 100 }).catch(() => 'n/a'), 'n/a');
    await m.fill('#in-sdonut', '135');
    await m.locator('#in-sdonut').blur();
    await m.fill('#in-wmmanju', '88');
    await m.click('#submitBtn');
    await m.waitForFunction(() => /2개 저장/.test(document.getElementById('toast').textContent));
    assert.strictEqual(s3.getLastRow(), 6);
    assert.strictEqual(s3.rows[5][1], 135);
    assert.strictEqual(s3.rows[5][s3.rows[0].indexOf('찹쌀도너츠')], 450, '먼저 저장한 값 유지');
  });

  await step('입력하다 새로고침해도 값이 남아 있다', async () => {
    await m.fill('#in-pimanju', '77');
    await m.locator('#in-pimanju').blur();
    await m.reload();
    await m.click('button[data-floor="3F"]');
    await m.waitForSelector('#inv-pimanju');
    assert.strictEqual(await m.inputValue('#in-pimanju'), '77');
    assert.strictEqual(s3.rows[5][s3.rows[0].indexOf('파이만쥬')] || '', '', '아직 저장 전');
    await m.click('.back-btn');
  });

  await step('생산총괄: 비밀번호가 틀리면 못 들어가고, 맞으면 들어간다', async () => {
    await m.click('button:has-text("생산총괄")');
    await m.waitForSelector('#pinSheet:not(.hidden)');
    await shot(m, '07-비밀번호');
    await m.fill('#pinInput', '0000');
    await m.click('#pinOk');
    await m.waitForFunction(() => /올바르지/.test(document.getElementById('pinErr').textContent));
    assert.ok(await m.locator('#roleView').isVisible());
    await m.fill('#pinInput', '4826');
    await m.click('#pinOk');
    await m.waitForSelector('#card-s1');
    const src = fs.readFileSync(path.join(PUB, 'manage.html'), 'utf8');
    assert.ok(!src.includes('4826') && !src.includes("'2024'"), '화면 코드에 비밀번호가 없어야 함');
  });

  await step('리더 입력 현황이 실제 저장 상태를 보여준다', async () => {
    await m.waitForFunction(() => /3F/.test(document.getElementById('floorStatus').textContent) && !/확인 중/.test(document.getElementById('floorStatus').textContent));
    const t = await m.locator('#floorStatus').innerText();
    assert.ok(/2F 미작성/.test(t) && /3F 5\/24/.test(t) && /4F 미작성/.test(t), t);
  });

  await step('체크·메모가 새로고침 후에도 남고, 진행률은 13개 기준으로 센다', async () => {
    await m.click('#card-s1 .check-row');
    await m.click('#sub-s4-sub0'); await m.click('#sub-s4-sub1');
    await m.fill('#memo-s2', '크로와상 12개 발효 과다');
    await m.fill('#num-s6-bang', '4');
    assert.ok(/1 \/ 13 완료/.test(await m.locator('#progressLabel').innerText()));
    await m.reload();
    await m.click('button:has-text("생산총괄")');                              // 같은 탭에서는 비밀번호를 다시 묻지 않음
    await m.waitForSelector('#card-s1.done');
    assert.strictEqual(await m.inputValue('#memo-s2'), '크로와상 12개 발효 과다');
    assert.strictEqual(await m.inputValue('#num-s6-bang'), '4');
    assert.ok(await m.locator('#sub-s4-sub1').evaluate(e => e.classList.contains('on')));
    assert.ok(/1 \/ 13 완료/.test(await m.locator('#progressLabel').innerText()));
    assert.ok(/중간 저장 \(★ 9개 남음\)/.test(await m.locator('#submitBtn').innerText()), await m.locator('#submitBtn').innerText());
    await shot(m, '08-생산총괄-점검', true);
  });

  await step('중간 저장 → 노션 "작성중", 전부 체크 후 저장 → 같은 기록을 "작성완료"로 고친다', async () => {
    const log = be.manage.fetchLog;
    await m.click('#submitBtn');
    await m.waitForFunction(() => /중간 저장했어요/.test(document.getElementById('toast').textContent));
    let last = log[log.length - 1];
    assert.strictEqual(last.opt.method, 'post');
    let props = JSON.parse(last.opt.payload).properties;
    assert.strictEqual(props['상태'].select.name, '📝 작성중');
    assert.strictEqual(props['조회 진행'].checkbox, true);
    assert.strictEqual(props['3F 워크인 확인'].checkbox, true);
    assert.strictEqual(props['빵앙금(박스)'].number, 4);
    assert.strictEqual(props['폐기 메모'].rich_text[0].text.content, '크로와상 12개 발효 과다');

    for (const id of ['s2', 's3', 's4', 's5', 'sq', 's6', 's7', 'shyg', 's9']) await m.click('#card-' + id + ' .check-row');
    assert.ok(/점검 완료 저장/.test(await m.locator('#submitBtn').innerText()));
    await m.click('#submitBtn');
    await m.waitForFunction(() => /오늘 점검을 저장/.test(document.getElementById('toast').textContent));
    last = log[log.length - 1];
    assert.strictEqual(last.opt.method, 'patch'); assert.ok(/pages\/page-1$/.test(last.url));
    assert.strictEqual(JSON.parse(last.opt.payload).properties['상태'].select.name, '✅ 작성완료');
    await m.click('.back-btn');
  });

  await step('대표: 비밀번호 후 지시사항 저장 → 리더 화면 맨 위에 표시', async () => {
    await m.click('text=대표');
    await m.waitForSelector('#pinSheet:not(.hidden)');
    await m.fill('#pinInput', '7391');
    await m.press('#pinInput', 'Enter');
    await m.waitForSelector('#ceoText');
    await m.fill('#ceoText', '토요일 예약 많음. 2층 시트 2배 준비.');
    await m.click('#submitBtn');
    await m.waitForFunction(() => /지시사항을 저장/.test(document.getElementById('toast').textContent));
    await m.click('.back-btn');
    await m.click('button[data-floor="2F"]');
    await m.waitForSelector('#inv-wsm');
    assert.ok(/토요일 예약 많음/.test(await m.locator('.notice-box').innerText()));
    await m.waitForFunction(() => getComputedStyle(document.querySelector('.role-band')).backgroundColor === 'rgb(180, 80, 107)', null, { timeout: 3000 });
    await shot(m, '09-재고-2F', false);
    await noOverflow(m);
  });
  await m.context().close();

  await step('좁은 휴대폰(360px)에서도 가로로 넘치지 않는다', async () => {
    const q = await newPage(360);
    await q.goto(base + '/manage.html');
    await q.click('button[data-floor="4F"]');
    await q.waitForSelector('#inv-salt');
    await q.fill('#in-salt', '99999'); await q.locator('#in-salt').blur();
    await noOverflow(q);
    await shot(q, '10-재고-4F-360px');
    await q.goto(base + '/production.html');
    await q.selectOption('#loginName', '박사층'); await q.fill('#loginPin', '1111'); await q.click('#loginBtn');
    await q.waitForSelector('#mainView:not(.hidden)');
    await noOverflow(q);
    await q.context().close();
  });

  await step('브라우저 오류가 없다', async () => { assert.deepStrictEqual(errors, []); });

  await browser.close();
  server.close();
  console.log(`\n통과 ${passed}건` + (failed ? ` · 실패 ${failed}건` : ''));
  process.exit(failed ? 1 : 0);
})();
