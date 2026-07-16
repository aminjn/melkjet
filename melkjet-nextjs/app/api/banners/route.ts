import { NextRequest, NextResponse } from 'next/server'
import { listActive, listActiveFor, getActiveBanner, trackClick, Placement } from '@/app/lib/banner-store'

const PLACEMENTS: Placement[] = ['home', 'search', 'sidebar', 'article']

// PUBLIC: GET ?placement=&cat=&slug=  یا  ?id= → بنرهای فعال (فیلدهای عمومیِ حداقلی)
// فاز ۱۵۰: cat/slug زمینهٔ مقاله‌اند (اولویت: بنرِ همین مقاله > دسته > عمومی)؛ id = بنرِ مشخصِ مقاله‌ساز.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const pub = (b: { id: string; title: string; image: string; link: string }) => ({ id: b.id, title: b.title, image: b.image, link: b.link })
  const byId = sp.get('id')
  if (byId) {
    const b = getActiveBanner(byId)
    return NextResponse.json({ banners: b ? [pub(b)] : [] })
  }
  const p = sp.get('placement')
  const placement = p && PLACEMENTS.includes(p as Placement) ? (p as Placement) : undefined
  const cat = sp.get('cat') || undefined
  const slug = sp.get('slug') || undefined
  const banners = (placement && (cat || slug) ? listActiveFor(placement, { category: cat, slug }) : listActive(placement)).map(pub)
  return NextResponse.json({ banners })
}

// PUBLIC: POST { id } → track a click
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  trackClick(String(b.id))
  return NextResponse.json({ ok: true })
}
