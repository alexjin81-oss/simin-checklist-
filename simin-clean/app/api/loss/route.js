import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

// 매장 마감 기부·폐기 앱(loss.html) → 노션 '마감 기부·폐기 기록' 표 + 슬랙 #물량 요약.
// 노션 표 ID는 비밀이 아니라 코드에 두고, 토큰·웹훅은 Vercel 환경변수(NOTION_API_KEY, SLACK_WEBHOOK_URL)에만 둔다.
const LOSS_DB = process.env.NOTION_LOSS_DB_ID || '200eda1bcde04adf848236622d137a48';
const CATS = new Set(['기부', '폐기', '재판', '3층', '효자이관']);

function notionClient() {
  return process.env.NOTION_API_KEY ? new Client({ auth: process.env.NOTION_API_KEY }) : null;
}

// 같은 마감일자+매장 기록이 이미 있으면 보관(archive)하고 새로 적는다 (재등록 = 덮어쓰기).
async function archiveExisting(notion, date, store) {
  let cursor;
  do {
    const r = await notion.databases.query({
      database_id: LOSS_DB,
      start_cursor: cursor,
      filter: { and: [
        { property: '마감일자', date: { equals: date } },
        { property: '매장', select: { equals: store } },
      ] },
    });
    for (const p of r.results) await notion.pages.update({ page_id: p.id, archived: true });
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const { date, store, writer = '', memo = '', rows = [], text = '' } = body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !store || !Array.isArray(rows) || rows.length === 0 || rows.length > 200) {
    return NextResponse.json({ ok: false, error: 'bad payload' }, { status: 400 });
  }
  const clean = rows
    .filter(r => r && typeof r.name === 'string' && CATS.has(r.cat) && Number(r.qty) > 0)
    .map(r => ({
      name: String(r.name).slice(0, 100), cat: r.cat, qty: Number(r.qty),
      unit: r.unit === 'kg' ? 'kg' : '개',
      price: Number.isFinite(Number(r.price)) && r.price !== '' && r.price !== null ? Number(r.price) : null,
    }));
  if (!clean.length) return NextResponse.json({ ok: false, error: 'no rows' }, { status: 400 });

  const result = { ok: true, notion: false, slack: false, errors: [] };

  const notion = notionClient();
  if (notion) {
    try {
      await archiveExisting(notion, date, store);
      for (const r of clean) {
        const amt = r.price != null ? Math.round(r.qty * r.price) : null;
        const props = {
          '제목': { title: [{ text: { content: `${date}_${store}_${r.cat}_${r.name}` } }] },
          '마감일자': { date: { start: date } },
          '매장': { select: { name: store } },
          '구분': { select: { name: r.cat } },
          '제품명': { rich_text: [{ text: { content: r.name } }] },
          '수량': { number: r.qty },
          '단위': { select: { name: r.unit } },
          '작성자': { rich_text: [{ text: { content: String(writer).slice(0, 50) } }] },
          '메모': { rich_text: [{ text: { content: String(memo).slice(0, 500) } }] },
        };
        if (r.price != null) props['단가'] = { number: r.price };
        if (amt != null) props['손실액'] = { number: amt };
        await notion.pages.create({ parent: { database_id: LOSS_DB }, properties: props });
      }
      result.notion = true;
    } catch (e) {
      console.error('notion', e);
      result.errors.push('notion: ' + (e.message || e));
    }
  } else result.errors.push('notion: NOTION_API_KEY not set');

  const hook = process.env.SLACK_WEBHOOK_URL;
  if (hook && typeof text === 'string' && text && text.length <= 4000) {
    try {
      const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!r.ok) throw new Error('slack ' + r.status);
      result.slack = true;
    } catch (e) {
      console.error('slack', e);
      result.errors.push('slack: ' + (e.message || e));
    }
  }

  result.ok = result.notion || result.slack;
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
