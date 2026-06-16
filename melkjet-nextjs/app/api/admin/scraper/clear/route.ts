import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { clearItems, SourceType } from '@/app/lib/scraper-store'

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const type = b.type as SourceType | undefined
  clearItems(type && ['listing', 'directory', 'product', 'article', 'price'].includes(type) ? type : undefined)
  return NextResponse.json({ ok: true })
}
