import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { siteConfig, saveSiteConfig, upsertPage, deletePage } from '@/app/lib/site-store'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ config: siteConfig() })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const action = String(b.action || 'save')
  if (action === 'save') {
    const cfg = saveSiteConfig({ footer: b.footer, contact: b.contact })
    return NextResponse.json({ ok: true, config: cfg })
  }
  if (action === 'page') {
    const r = upsertPage(b.page || {})
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true, config: r.cfg })
  }
  if (action === 'deletePage') {
    const r = deletePage(String(b.slug || ''))
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true, config: r.cfg })
  }
  return NextResponse.json({ error: 'اکشن ناشناخته' }, { status: 400 })
}
