import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  listCategories, addCategory, updateCategory, deleteCategory,
  listProducts, addProduct, updateProduct, deleteProduct, catalogStats, clearCatalog,
} from '@/app/lib/catalog-store'
import { hasCap } from '@/app/lib/account-store'

// مدیریتِ کاتالوگِ مرجع — سوپرادمین یا کاربرِ دارای دسترسیِ «catalog».
async function guard() {
  const s = await getSession()
  if (!s) return null
  if (s.role === 'super_admin' || hasCap(s.phone, 'catalog')) return s
  return null
}

export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const u = req.nextUrl.searchParams
  const cats = listCategories()
  const catId = u.get('categoryId') || undefined
  // انتخابِ یک دستهٔ والد، محصولاتِ همهٔ زیردسته‌هایش را هم نشان می‌دهد.
  let products = listProducts({ search: u.get('search') || undefined })
  if (catId) {
    const ids = new Set<string>([catId])
    let grew = true
    while (grew) { grew = false; for (const c of cats) if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) { ids.add(c.id); grew = true } }
    products = products.filter(p => ids.has(p.categoryId))
  }
  return NextResponse.json({ categories: cats, products, stats: catalogStats() })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  switch (b.action as string) {
    case 'addCategory':
      if (!b.name) return NextResponse.json({ error: 'نام دسته الزامی است' }, { status: 400 })
      return NextResponse.json({ ok: true, category: addCategory({ name: b.name, parentId: b.parentId, order: b.order }) })
    case 'updateCategory':
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      return NextResponse.json({ ok: true, category: updateCategory(String(b.id), b.patch || {}) })
    case 'deleteCategory':
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      deleteCategory(String(b.id)); return NextResponse.json({ ok: true })
    case 'addProduct':
      if (!b.name || !b.categoryId) return NextResponse.json({ error: 'نام و دسته الزامی است' }, { status: 400 })
      return NextResponse.json({ ok: true, product: addProduct(b) })
    case 'updateProduct':
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      return NextResponse.json({ ok: true, product: updateProduct(String(b.id), b.patch || {}) })
    case 'deleteProduct':
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      deleteProduct(String(b.id)); return NextResponse.json({ ok: true })
    case 'clearCatalog':
      return NextResponse.json({ ok: true, cleared: clearCatalog(b.scope === 'all' ? 'all' : 'scraped') })
    default:
      return NextResponse.json({ error: 'عملیاتِ نامعتبر' }, { status: 400 })
  }
}
