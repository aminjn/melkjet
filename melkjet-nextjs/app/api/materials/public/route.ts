import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { publicShop, shopPhone, shopBySlug, addPublicInquiry } from '@/app/lib/materials-store'
import { addContact } from '@/app/lib/contact-log-store'
import { getAccount } from '@/app/lib/account-store'

export const dynamic = 'force-dynamic'

// ویترینِ عمومیِ فروشگاهِ مصالح — بدونِ شماره تلفن (شماره فقط با ورود، از POST reveal).
export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get('slug') || ''
  if (!slug) return NextResponse.json({ error: 'شناسهٔ فروشگاه لازم است' }, { status: 400 })
  const shop = await publicShop(slug)
  if (!shop) return NextResponse.json({ error: 'فروشگاه یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, shop })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any))
  const slug = String(b.slug || '')
  const action = String(b.action || '')
  const found = await shopBySlug(slug)
  if (!found) return NextResponse.json({ error: 'فروشگاه یافت نشد' }, { status: 404 })

  if (action === 'reveal') {
    // شماره فقط برای کاربرِ واردشده؛ تماس در پنلِ فروشنده ثبت می‌شود.
    const s = await getSession()
    if (!s) return NextResponse.json({ login: true, error: 'برای دیدنِ شماره وارد شوید' }, { status: 401 })
    const phone = await shopPhone(slug)
    if (!phone) return NextResponse.json({ error: 'شماره‌ای ثبت نشده' }, { status: 404 })
    await addContact(found.owner, { viewerPhone: s.phone, viewerName: getAccount(s.phone)?.name, projectName: b.productName || 'ویترینِ فروشگاه', at: Date.now() })
    return NextResponse.json({ ok: true, phone })
  }

  if (action === 'inquiry') {
    // استعلامِ خریدار → به پنلِ فروشنده اضافه می‌شود (نیاز به ورود، تا اسپم نشود).
    const s = await getSession()
    if (!s) return NextResponse.json({ login: true, error: 'برای ارسالِ استعلام وارد شوید' }, { status: 401 })
    if (!b.product) return NextResponse.json({ error: 'محصول را مشخص کنید' }, { status: 400 })
    const q = await addPublicInquiry(slug, {
      customer: String(b.customer || getAccount(s.phone)?.name || s.phone).slice(0, 80),
      product: String(b.product).slice(0, 120),
      qty: String(b.qty || '').slice(0, 60),
      note: b.note ? String(b.note).slice(0, 400) : undefined,
    })
    if (!q) return NextResponse.json({ error: 'ثبت نشد' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'عملیاتِ نامعتبر' }, { status: 400 })
}
