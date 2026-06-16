import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listItems, setItemStatus, SourceType, ItemStatus } from '@/app/lib/scraper-store'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const type = sp.get('type') as SourceType | null
  const category = sp.get('category') || undefined
  const valid = type && ['listing', 'directory', 'product', 'article', 'price'].includes(type)
  const items = listItems(valid ? type : undefined, { category })
  return NextResponse.json({ items: items.slice(0, 200) })
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
