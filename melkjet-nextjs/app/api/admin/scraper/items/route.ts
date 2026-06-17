import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listItems, setItemStatus, updateItem, deleteItem, deleteItems, SourceType, ItemStatus, EditableItem } from '@/app/lib/scraper-store'
import { clearEnrichment } from '@/app/lib/enrich-store'

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
  let items = listItems(valid ? type : undefined, { category })
  const status = sp.get('status')
  if (status) items = items.filter(i => i.status === status)
  const q = (sp.get('q') || '').trim()
  if (q) items = items.filter(i => i.title.includes(q) || (i.location || '').includes(q) || (i.sourceName || '').includes(q))
  return NextResponse.json({ items: items.slice(0, 300), total: items.length })
}

// PATCH: { id, status }  OR  { id, patch:{...editable fields} }
export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  if (b.patch && typeof b.patch === 'object') {
    const it = updateItem(b.id, b.patch as EditableItem)
    if (!it) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    clearEnrichment(b.id)   // کش غنی‌سازی باطل شود تا ویرایش اعمال گردد
    return NextResponse.json({ ok: true, item: it })
  }
  if (b.status && ['pending', 'approved', 'duplicate', 'rejected'].includes(b.status)) {
    setItemStatus(b.id, b.status as ItemStatus)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'ورودی نامعتبر' }, { status: 400 })
}

// DELETE ?id=xxx  OR body { ids:[...] }
export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (id) { deleteItem(id); return NextResponse.json({ ok: true }) }
  const b = await req.json().catch(() => ({}))
  if (Array.isArray(b.ids)) { deleteItems(b.ids); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
}
