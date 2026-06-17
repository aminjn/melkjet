import { NextRequest, NextResponse } from 'next/server'
import { getItemById } from '@/app/lib/scraper-store'

// Public: a single scraped item by id (for the property/detail page).
export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const item = getItemById(id)
  if (!item || item.status === 'rejected') return NextResponse.json({ item: null }, { status: 404 })
  return NextResponse.json({ item })
}
