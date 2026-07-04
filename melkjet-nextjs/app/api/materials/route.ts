import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  shopStats, listProducts, listOrders, listInquiries,
  addProduct, updateProduct, deleteProduct, restock,
  addOrder, setOrderStatus, addInquiry, answerInquiry, updateProfile,
  type OrderStatus,
} from '@/app/lib/materials-store'

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
  const owner = s.phone
  const b = await req.json().catch(() => ({} as any))
  const action = b.action as string

  switch (action) {
    case 'addProduct': {
      // یا از کاتالوگِ مرجع انتخاب شده (catalogId) یا دستی با نام. بقیهٔ فیلدها در store پاک‌سازی می‌شوند.
      if (!b.catalogId && !b.name) return NextResponse.json({ error: 'کالا را از کاتالوگ انتخاب کنید یا نام را وارد کنید' }, { status: 400 })
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
    default:
      return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
