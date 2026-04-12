import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DAILY_RECORD_DB = process.env.NOTION_DAILY_RECORD_DB_ID;

export async function POST(request) {
  try {
    const { location, shift, worker, itemName, completedTime, inputValue, date } = await request.json();

    const title = `${date}_${location}_${itemName}`;

    await notion.pages.create({
      parent: { database_id: DAILY_RECORD_DB },
      properties: {
        "기록제목": { title: [{ text: { content: title } }] },
        "근무지": { select: { name: location } },
        "시프트": { select: { name: shift } },
        "담당자": { rich_text: [{ text: { content: worker } }] },
        "완료여부": { checkbox: true },
        "완료시각": { rich_text: [{ text: { content: completedTime } }] },
        "입력값": { rich_text: [{ text: { content: inputValue || "" } }] },
        "날짜": { date: { start: date } },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notion API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
