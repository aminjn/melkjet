import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  listCategories, addCategory, updateCategory, deleteCategory,
  listProducts, addProduct, updateProduct, deleteProduct, catalogStats, clearCatalog,
  categoriesNeedingImage, setCategoryImage, bulkDeleteQuery, bulkDeleteProducts, enrichStats,
  getProduct, countImageUsage, clearImageEverywhere,
} from '@/app/lib/catalog-store'
import { hasCap } from '@/app/lib/account-store'
import { generateImage, agentModel, agentProvider } from '@/app/lib/gapgpt'
import { enrichCatalogBatch } from '@/app/lib/catalog-enrich'

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
  return NextResponse.json({ categories: cats, products, stats: catalogStats(), enrich: enrichStats() })
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
      return NextResponse.json({ ok: true, cleared: clearCatalog(b.scope === 'all' ? 'all' : (b.scope || 'scraped')) })
    case 'bulkDeleteCount':
      return NextResponse.json({ ok: true, ...bulkDeleteQuery(b.filter || {}) })
    case 'bulkDelete':
      return NextResponse.json({ ok: true, ...bulkDeleteProducts(b.filter || {}) })
    case 'enrichText': {
      // تکمیلِ توضیحات/مشخصاتِ فنیِ محصولاتِ اسکرپ‌شده با AI (بَچ‌به‌بَچ؛ UI تا پایان تکرار می‌کند).
      const r = await enrichCatalogBatch({ source: b.source || undefined, limit: 4 })
      if (r.noModel) return NextResponse.json({ error: 'به ایجنتِ ContentAgent یک مدلِ متن بدهید (پنل → API و مدل‌های AI).' }, { status: 400 })
      return NextResponse.json({ ok: true, ...r })
    }
    case 'genImages': {
      // تولیدِ عکسِ AI برای دسته‌هایِ بدونِ عکس (هر بار چند تا؛ UI تا پایان تکرار می‌کند).
      const model = agentModel('content', 'image') || agentModel('studio', 'image')
      if (!model) return NextResponse.json({ error: 'به ایجنتِ ContentAgent یک مدلِ تصویر بدهید (پنل → API و مدل‌های AI).' }, { status: 400 })
      const provider = agentProvider('content', 'image') || agentProvider('studio', 'image')
      const need = categoriesNeedingImage()
      const batch = need.slice(0, 4)
      let generated = 0, applied = 0
      for (const c of batch) {
        try {
          const prompt = `Realistic professional product photo of Iranian construction/building material category "${c.name}", isolated on clean white studio background, centered, sharp, high quality, no people, no person, no human, no hands, no text, no watermark, no logo.`
          const url = await generateImage(model, prompt, '1024x1024', provider)
          if (url) { applied += setCategoryImage(c.id, url); generated++ }
        } catch { /* یکی خطا داد، بقیه ادامه */ }
      }
      return NextResponse.json({ ok: true, generated, applied, remaining: Math.max(0, need.length - batch.length) })
    }
    case 'genProductImage': {
      // تولیدِ عکسِ AI برای یک کالای مشخص (جایگزینیِ عکسِ اشتباه).
      const model = agentModel('content', 'image') || agentModel('studio', 'image')
      if (!model) return NextResponse.json({ error: 'به ایجنتِ ContentAgent یک مدلِ تصویر بدهید (پنل → API و مدل‌های AI).' }, { status: 400 })
      const provider = agentProvider('content', 'image') || agentProvider('studio', 'image')
      const p = getProduct(String(b.id)); if (!p) return NextResponse.json({ error: 'کالا یافت نشد' }, { status: 404 })
      const cat = listCategories().find(c => c.id === p.categoryId)?.name || ''
      const prompt = `Realistic professional product photo of Iranian construction/building material "${p.name}"${cat ? ` (category ${cat})` : ''}, isolated on clean white studio background, centered, sharp, high detail, no people, no person, no human, no hands, no text, no watermark, no logo.`
      try {
        const url = await generateImage(model, prompt, '1024x1024', provider)
        if (!url) return NextResponse.json({ error: 'تصویری تولید نشد' }, { status: 500 })
        return NextResponse.json({ ok: true, image: url, product: updateProduct(String(b.id), { image: url }) })
      } catch (e: any) { return NextResponse.json({ error: e?.message || 'خطا در تولیدِ تصویر' }, { status: 500 }) }
    }
    case 'imageUsage': {
      const p = getProduct(String(b.id))
      return NextResponse.json({ ok: true, image: p?.image || '', count: countImageUsage(p?.image || '') })
    }
    case 'clearSharedImage':
      return NextResponse.json({ ok: true, cleared: clearImageEverywhere(String(b.url || '')) })
    default:
      return NextResponse.json({ error: 'عملیاتِ نامعتبر' }, { status: 400 })
  }
}
