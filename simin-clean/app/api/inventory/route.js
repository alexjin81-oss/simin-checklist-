import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const INVENTORY_DB = process.env.NOTION_INVENTORY_DB_ID;

export async function POST(request) {
  try {
    const { pageId, quantity, worker } = await request.json();

    await notion.pages.update({
      page_id: pageId,
      properties: {
        "현재수량": { number: quantity },
        "수정자": { rich_text: [{ text: { content: worker } }] },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notion API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const response = await notion.databases.query({ database_id: INVENTORY_DB });

    const items = response.results.map(page => ({
      id: page.id,
      name: page.properties["품목명"]?.title?.[0]?.text?.content || "",
      location: page.properties["근무지"]?.select?.name || "",
      category: page.properties["분류"]?.select?.name || "",
      qty: page.properties["현재수량"]?.number || 0,
      unit: page.properties["단위"]?.select?.name || "개",
      made: page.properties["제조일"]?.date?.start || "",
      exp: page.properties["유효기한"]?.date?.start || "",
    }));

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('Notion API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
