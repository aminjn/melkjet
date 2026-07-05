import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listItems, setItemStatus, updateItem, deleteItem, deleteItems, addItemManual, getItemById, SourceType, ItemStatus, EditableItem } from '@/app/lib/scraper-store'
import { clearEnrichment } from '@/app/lib/enrich-store'
import { logAudit } from '@/app/lib/audit-store'
import { teachFromAdmin } from '@/app/lib/moderation'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}
async function actor() { const s = await getSession(); return (s as any)?.name || (s as any)?.phone || 'مدیر' }

// POST → ساخت دستی آیتم جدید (آگهی/محصول/…)
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const type = (['listing', 'directory', 'product', 'article', 'price'].includes(b.type) ? b.type : 'listing') as SourceType
  if (!b.title || !String(b.title).trim()) return NextResponse.json({ error: 'عنوان الزامی است' }, { status: 400 })
  const it = await addItemManual({
    type, title: String(b.title).slice(0, 200),
    price: b.price ? String(b.price) : undefined, location: b.location ? String(b.location) : undefined,
    image: b.image ? String(b.image) : undefined, url: b.url ? String(b.url) : undefined,
    excerpt: b.excerpt ? String(b.excerpt) : undefined, phone: b.phone ? String(b.phone) : undefined,
    category: b.category ? String(b.category) : undefined, owner: b.owner ? String(b.owner) : undefined,
  })
  // آگهیِ دستیِ ادمین = نمونهٔ مثبتِ باکیفیت برای مدلِ یادگیرنده (ادمین عمداً آن را ساخته).
  if (type === 'listing') { try { teachFromAdmin(it, 'approved') } catch {} }
  logAudit(await actor(), `ساخت ${type}`, it.title)
  return NextResponse.json({ ok: true, id: it.id, item: it })
}

export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const type = sp.get('type') as SourceType | null
  const category = sp.get('category') || undefined
  const valid = type && ['listing', 'directory', 'product', 'article', 'price'].includes(type)
  let items = await listItems(valid ? type : undefined, { category })
  const status = sp.get('status')
  // به‌صورتِ پیش‌فرض آگهی‌های «تکراری» (که خودکار مخفی شده‌اند) در فهرست نمایش داده نمی‌شوند
  // تا لیست شلوغ نشود؛ فقط وقتی فیلترِ «تکراری» انتخاب شود دیده می‌شوند.
  if (status) items = items.filter(i => i.status === status)
  else items = items.filter(i => i.status !== 'duplicate')
  const q = (sp.get('q') || '').trim()
  if (q) items = items.filter(i => i.title.includes(q) || (i.location || '').includes(q) || (i.sourceName || '').includes(q))
  // فهرستِ محله‌ها (facet) از روی موقعیتِ آگهی‌ها — قبل از اعمالِ فیلترِ محله تا دراپ‌داون خالی نشود.
  const norm = (s: string) => (s || '').replace(/‌/g, '').replace(/\s+/g, ' ').trim()
  const hoodOf = (loc: string) => { const p = norm(loc).split(/[،,]/).map(x => x.trim()).filter(Boolean); return p.length > 1 ? p[p.length - 1] : (p[0] || '') }
  const hoodCounts = new Map<string, number>()
  for (const i of items) { const h = hoodOf(i.location || ''); if (h && h !== 'نامشخص') hoodCounts.set(h, (hoodCounts.get(h) || 0) + 1) }
  const hoods = [...hoodCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([h, c]) => ({ h, c }))
  // فیلترِ محله/شهر (تطبیقِ متنیِ بی‌طرف نسبت به نیم‌فاصله)
  const loc = norm(sp.get('loc') || '')
  if (loc) items = items.filter(i => norm(i.location || '').includes(loc))
  return NextResponse.json({ items: items.slice(0, 300), total: items.length, hoods })
}

// PATCH: { id, status }  OR  { id, patch:{...editable fields} }
export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  if (b.patch && typeof b.patch === 'object') {
    const it = await updateItem(b.id, b.patch as EditableItem)
    if (!it) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    clearEnrichment(b.id)   // کش غنی‌سازی باطل شود تا ویرایش اعمال گردد
    return NextResponse.json({ ok: true, item: it })
  }
  if (b.status && ['pending', 'approved', 'duplicate', 'rejected'].includes(b.status)) {
    // مدلِ یادگیرنده از تصمیمِ دستیِ ادمین یاد بگیرد (قوی‌ترین سیگنال) — قبل از تغییرِ وضعیت آیتم را بگیر.
    if (b.status === 'approved' || b.status === 'rejected') { const it = await getItemById(b.id); if (it && it.type === 'listing') teachFromAdmin(it, b.status as ItemStatus) }
    await setItemStatus(b.id, b.status as ItemStatus)
    logAudit(await actor(), `تغییر وضعیت به ${b.status}`, b.id)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'ورودی نامعتبر' }, { status: 400 })
}

// DELETE ?id=xxx  OR body { ids:[...] }
export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (id) { await deleteItem(id); logAudit(await actor(), 'حذف آیتم', id); return NextResponse.json({ ok: true }) }
  const b = await req.json().catch(() => ({}))
  if (Array.isArray(b.ids)) { await deleteItems(b.ids); logAudit(await actor(), `حذف گروهی`, `${b.ids.length} مورد`); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
}
