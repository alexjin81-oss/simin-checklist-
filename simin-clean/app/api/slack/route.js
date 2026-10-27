import { NextResponse } from 'next/server';

// 매장 앱(order.html 등) → 슬랙 Incoming Webhook 중계.
// 웹훅 주소는 코드가 아니라 Vercel 환경변수 SLACK_WEBHOOK_URL 에 둔다 (저장소가 공개라서).
export async function POST(request) {
  const hook = process.env.SLACK_WEBHOOK_URL;
  if (!hook) return NextResponse.json({ ok: false, error: 'SLACK_WEBHOOK_URL not set' }, { status: 500 });
  try {
    const { text } = await request.json();
    if (!text || typeof text !== 'string' || text.length > 4000) {
      return NextResponse.json({ ok: false, error: 'bad text' }, { status: 400 });
    }
    const r = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) return NextResponse.json({ ok: false, error: 'slack ' + r.status }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
