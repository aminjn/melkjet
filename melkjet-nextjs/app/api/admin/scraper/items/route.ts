import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listItems, setItemStatus, SourceType, ItemStatus } from '@/app/lib/scraper-store'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const type = new URL(req.url).searchParams.get('type') as SourceType | null
  const items = listItems(type && ['listing', 'article', 'price'].includes(type) ? type : undefined)
  return NextResponse.json({ items: items.slice(0, 100) })
}

export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { id, status } = await req.json()
  if (!id || !['pending', 'approved', 'duplicate', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'ورودی نامعتبر' }, { status: 400 })
  }
  setItemStatus(id, status as ItemStatus)
  return NextResponse.json({ ok: true })
}
