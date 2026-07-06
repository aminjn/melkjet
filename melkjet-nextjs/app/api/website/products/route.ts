import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listProducts } from '@/app/lib/materials-store'

// محصولاتِ فروشندهٔ واردشده — برای پیش‌نمایشِ زندهٔ بلوکِ «محصولات/کاتالوگ» در سایت‌ساز.
// فقط محصولاتِ فعال، بدونِ دادهٔ حساس؛ کاملِ دیتا (نام/برند/قیمت/واحد/دسته/عکس/تخفیف).
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ products: [] }, { headers: { 'Cache-Control': 'no-store' } })
  const all = await listProducts(s.phone)
  const products = all.filter(p => p.active !== false).map(p => ({
    name: p.name, brand: p.brand || '', category: p.category || '', price: p.price || 0,
    unit: p.unit || '', image: (p.images && p.images[0]) || '', discountPct: p.discountPct || 0,
    stock: p.stock || 0, featured: !!p.featured,
  }))
  return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store, private' } })
}
