import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listCategories, listProducts } from '@/app/lib/catalog-store'

export const dynamic = 'force-dynamic'

// کاتالوگِ مرجع برای انتخابِ مصالح‌فروش (فقط خواندنی، نیاز به ورود).
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const u = req.nextUrl.searchParams
  return NextResponse.json({
    ok: true,
    categories: listCategories(true),
    products: listProducts({ categoryId: u.get('categoryId') || undefined, search: u.get('search') || undefined, activeOnly: true }),
  })
}
