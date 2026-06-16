import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listSources, addSource, updateSource, deleteSource, SourceType, Method } from '@/app/lib/scraper-store'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ sources: listSources() })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json()
  if (!b.name || !b.url) return NextResponse.json({ error: 'نام و آدرس الزامی است' }, { status: 400 })
  try { new URL(b.url) } catch { return NextResponse.json({ error: 'آدرس نامعتبر است' }, { status: 400 }) }
  const src = addSource({
    name: String(b.name).slice(0, 80),
    url: String(b.url),
    type: (['listing', 'article', 'price'].includes(b.type) ? b.type : 'listing') as SourceType,
    method: (['auto', 'jsonld', 'og', 'rss'].includes(b.method) ? b.method : 'auto') as Method,
    enabled: b.enabled !== false,
    schedule: ['manual', 'hourly', '6h', 'daily'].includes(b.schedule) ? b.schedule : 'manual',
  })
  return NextResponse.json({ ok: true, source: src })
}

export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const s = updateSource(b.id, b.patch || {})
  if (!s) return NextResponse.json({ error: 'منبع یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, source: s })
}

export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  deleteSource(id)
  return NextResponse.json({ ok: true })
}
