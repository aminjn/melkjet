import { NextRequest, NextResponse } from 'next/server'
import { requireModule, requireQuota } from '@/app/lib/plan-gate'
import { getSession } from '@/app/lib/session'
import {
  shopStats, listProducts, listOrders, listInquiries,
  addProduct, updateProduct, deleteProduct, restock, findShopProductTwin,
  addOrder, setOrderStatus, addInquiry, answerInquiry, updateProfile, getShop,
  type OrderStatus,
} from '@/app/lib/materials-store'
import { demandForecast, priceInsights } from '@/app/lib/materials-ai'
import { aiFor, agentModel, agentProvider } from '@/app/lib/gapgpt'
const { chatCompleteSafe } = aiFor('پنلِ مصالح')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

// همهٔ دادهٔ پنل بازار مصالح، مخصوص کاربرِ واردشده (per-profile).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const owner = s.phone
  return NextResponse.json({
    stats: await shopStats(owner),
    products: await listProducts(owner),
    orders: await listOrders(owner),
    inquiries: await listInquiries(owner),
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  { const pg51 = requireModule(s as any, 'store'); if (pg51) return NextResponse.json(pg51, { status: 403 }) }   // فاز ۵۱: اعمالِ پلن
  const owner = s.phone
  const b = await req.json().catch(() => ({} as any))
  const action = b.action as string

  switch (action) {
    case 'addProduct': {
      { const q52 = requireQuota(s as any, 'products', (await listProducts(owner)).length); if (q52) return NextResponse.json(q52, { status: 403 }) }   // فاز ۵۲: سقفِ داینامیکِ پلن
      // یا از کاتالوگِ مرجع انتخاب شده (catalogId) یا دستی با نام. بقیهٔ فیلدها در store پاک‌سازی می‌شوند.
      if (!b.catalogId && !b.name) return NextResponse.json({ error: 'کالا را از کاتالوگ انتخاب کنید یا نام را وارد کنید' }, { status: 400 })
      // گِیتِ ضدتکراری: همان کالا (کاتالوگ یا نام+واحد) قبلاً در فروشگاهِ شما ثبت شده → ویرایشِ همان.
      const twin = await findShopProductTwin(owner, { name: b.name ? String(b.name) : undefined, unit: b.unit ? String(b.unit) : undefined, catalogId: b.catalogId ? String(b.catalogId) : undefined })
      if (twin) return NextResponse.json({ error: `«${twin.name}» قبلاً در فروشگاهِ شما ثبت شده — به‌جای ثبتِ دوباره، همان محصول را ویرایش کنید (قیمت/موجودی).`, duplicateOf: twin.id }, { status: 409 })
      const { action: _a, ...fields } = b
      return NextResponse.json({ ok: true, product: await addProduct(owner, fields) })
    }
    case 'updateProduct': {
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      const p = await updateProduct(owner, String(b.id), b.patch || {})
      if (!p) return NextResponse.json({ error: 'محصول یافت نشد' }, { status: 404 })
      return NextResponse.json({ ok: true, product: p })
    }
    case 'deleteProduct': {
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      await deleteProduct(owner, String(b.id))
      return NextResponse.json({ ok: true })
    }
    case 'restock': {
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      const p = await restock(owner, String(b.id), Number(b.qty) || 0)
      if (!p) return NextResponse.json({ error: 'محصول یافت نشد' }, { status: 404 })
      return NextResponse.json({ ok: true, product: p })
    }
    case 'addOrder': {
      if (!b.customer) return NextResponse.json({ error: 'نام مشتری الزامی است' }, { status: 400 })
      const lines = Array.isArray(b.lines) ? b.lines.map((l: any) => ({ productId: String(l.productId || ''), qty: Number(l.qty) || 0 })).filter((l: any) => l.productId && l.qty > 0) : undefined
      return NextResponse.json({ ok: true, order: await addOrder(owner, { customer: String(b.customer), items: b.items != null ? Number(b.items) : undefined, amount: b.amount != null ? Number(b.amount) : undefined, status: b.status, lines }) })
    }
    case 'setOrderStatus': {
      if (!b.id || !b.status) return NextResponse.json({ error: 'شناسه و وضعیت الزامی است' }, { status: 400 })
      const o = await setOrderStatus(owner, String(b.id), b.status as OrderStatus)
      if (!o) return NextResponse.json({ error: 'سفارش یا وضعیت نامعتبر' }, { status: 404 })
      return NextResponse.json({ ok: true, order: o })
    }
    case 'addInquiry': {
      if (!b.customer || !b.product) return NextResponse.json({ error: 'مشتری و محصول الزامی است' }, { status: 400 })
      return NextResponse.json({ ok: true, inquiry: await addInquiry(owner, { customer: String(b.customer), product: String(b.product), qty: String(b.qty || ''), note: b.note }) })
    }
    case 'answerInquiry': {
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      const q = await answerInquiry(owner, String(b.id), String(b.reply || ''))
      if (!q) return NextResponse.json({ error: 'استعلام یافت نشد' }, { status: 404 })
      return NextResponse.json({ ok: true, inquiry: q })
    }
    case 'updateProfile': {
      return NextResponse.json({ ok: true, profile: await updateProfile(owner, b.patch || {}) })
    }
    case 'aiInsights': {
      const shop = await getShop(owner)
      const forecast = demandForecast(shop)
      const prices = priceInsights(shop)
      let advice: string | null = null
      const model = agentModel('chat', 'text') || agentModel('content', 'text')
      if (model) {
        try {
          advice = (await chatCompleteSafe(model, [
            { role: 'system', content: 'تو مشاورِ فروشِ B2B مصالحِ ساختمانی هستی. کوتاه، فارسی و عملی پاسخ بده.' },
            { role: 'user', content: `فروشگاه با ${shop.products.filter(p => p.active).length} محصولِ فعال، روندِ فروش ${forecast.trendPct}٪، ${forecast.restock.length} محصولِ نیازمندِ تأمین. برای افزایشِ فروش و مدیریتِ موجودی چه پیشنهادی داری؟` },
          ], { temperature: 0.5, max_tokens: 220 }, agentProvider('chat', 'text'))).trim() || null
        } catch {}
      }
      return NextResponse.json({ ok: true, forecast, prices, advice })
    }
    default:
      return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
