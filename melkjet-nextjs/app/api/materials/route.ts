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
    stats: shopStats(owner),
    products: listProducts(owner),
    orders: listOrders(owner),
    inquiries: listInquiries(owner),
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
      if (!b.name || !b.category || !b.unit) return NextResponse.json({ error: 'نام، دسته و واحد الزامی است' }, { status: 400 })
      return NextResponse.json({ ok: true, product: addProduct(owner, { name: String(b.name), category: String(b.category), price: Number(b.price) || 0, unit: String(b.unit), stock: Number(b.stock) || 0, threshold: b.threshold != null ? Number(b.threshold) : undefined }) })
    }
    case 'updateProduct': {
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      const p = updateProduct(owner, String(b.id), b.patch || {})
      if (!p) return NextResponse.json({ error: 'محصول یافت نشد' }, { status: 404 })
      return NextResponse.json({ ok: true, product: p })
    }
    case 'deleteProduct': {
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      deleteProduct(owner, String(b.id))
      return NextResponse.json({ ok: true })
    }
    case 'restock': {
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      const p = restock(owner, String(b.id), Number(b.qty) || 0)
      if (!p) return NextResponse.json({ error: 'محصول یافت نشد' }, { status: 404 })
      return NextResponse.json({ ok: true, product: p })
    }
    case 'addOrder': {
      if (!b.customer) return NextResponse.json({ error: 'نام مشتری الزامی است' }, { status: 400 })
      const lines = Array.isArray(b.lines) ? b.lines.map((l: any) => ({ productId: String(l.productId || ''), qty: Number(l.qty) || 0 })).filter((l: any) => l.productId && l.qty > 0) : undefined
      return NextResponse.json({ ok: true, order: addOrder(owner, { customer: String(b.customer), items: b.items != null ? Number(b.items) : undefined, amount: b.amount != null ? Number(b.amount) : undefined, status: b.status, lines }) })
    }
    case 'setOrderStatus': {
      if (!b.id || !b.status) return NextResponse.json({ error: 'شناسه و وضعیت الزامی است' }, { status: 400 })
      const o = setOrderStatus(owner, String(b.id), b.status as OrderStatus)
      if (!o) return NextResponse.json({ error: 'سفارش یا وضعیت نامعتبر' }, { status: 404 })
      return NextResponse.json({ ok: true, order: o })
    }
    case 'addInquiry': {
      if (!b.customer || !b.product) return NextResponse.json({ error: 'مشتری و محصول الزامی است' }, { status: 400 })
      return NextResponse.json({ ok: true, inquiry: addInquiry(owner, { customer: String(b.customer), product: String(b.product), qty: String(b.qty || ''), note: b.note }) })
    }
    case 'answerInquiry': {
      if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
      const q = answerInquiry(owner, String(b.id), String(b.reply || ''))
      if (!q) return NextResponse.json({ error: 'استعلام یافت نشد' }, { status: 404 })
      return NextResponse.json({ ok: true, inquiry: q })
    }
    case 'updateProfile': {
      return NextResponse.json({ ok: true, profile: updateProfile(owner, b.patch || {}) })
    }
    default:
      return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
