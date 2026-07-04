import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listSources, addSource, updateSource, deleteSource, SourceType, Method, FieldRule, FieldKey } from '@/app/lib/scraper-store'

const FIELD_KEYS = ['title', 'price', 'location', 'image', 'url', 'phone', 'excerpt']

function sanitizeFields(raw: any): FieldRule[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = raw
    .filter((f: any) => f && FIELD_KEYS.includes(f.key) && typeof f.selector === 'string')
    .map((f: any) => ({ key: f.key as FieldKey, selector: String(f.selector).slice(0, 200), attr: String(f.attr || 'text').slice(0, 40) }))
  return out.length ? out : undefined
}

function sanitizeMeta(raw: any): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, string> = {}
  for (const k of Object.keys(raw)) {
    if (typeof raw[k] === 'string' && raw[k].trim()) out[String(k).slice(0, 40)] = String(raw[k]).slice(0, 120)
  }
  return Object.keys(out).length ? out : undefined
}

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ sources: await listSources() })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json()
  const method = (['auto', 'jsonld', 'og', 'rss', 'css', 'divar'].includes(b.method) ? b.method : 'auto') as Method
  // Divar connector uses the official API, not a page URL
  if (!b.name || (!b.url && method !== 'divar')) return NextResponse.json({ error: 'نام و آدرس الزامی است' }, { status: 400 })
  if (b.url) { try { new URL(b.url) } catch { return NextResponse.json({ error: 'آدرس نامعتبر است' }, { status: 400 }) } }
  const src = await addSource({
    name: String(b.name).slice(0, 80),
    url: String(b.url || 'https://divar.ir'),
    type: (['listing', 'directory', 'product', 'article', 'price'].includes(b.type) ? b.type : 'listing') as SourceType,
    category: b.type === 'directory' && b.category ? String(b.category).slice(0, 40) : undefined,
    method,
    enabled: b.enabled !== false,
    schedule: ['manual', 'hourly', '6h', 'daily'].includes(b.schedule) ? b.schedule : 'manual',
    container: method === 'css' && b.container ? String(b.container).slice(0, 200) : undefined,
    fields: method === 'css' ? sanitizeFields(b.fields) : undefined,
    meta: sanitizeMeta(b.meta),
    pages: b.pages ? Math.max(1, Math.min(20, parseInt(b.pages) || 1)) : undefined,
    useProxy: b.useProxy === true || undefined,
  })
  return NextResponse.json({ ok: true, source: src })
}

export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  const s = await updateSource(b.id, b.patch || {})
  if (!s) return NextResponse.json({ error: 'منبع یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, source: s })
}

export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  await deleteSource(id)
  return NextResponse.json({ ok: true })
}
