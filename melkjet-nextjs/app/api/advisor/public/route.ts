import { NextRequest, NextResponse } from 'next/server'
import { getAccount } from '@/app/lib/account-store'
import { getAdvisor, advisorStats } from '@/app/lib/advisor-store'
import { getAdvisorMembership } from '@/app/lib/agency-link-store'
import { listItems } from '@/app/lib/scraper-store'

// دادهٔ عمومیِ یک مشاور برای صفحهٔ پابلیک پروفایل. شناسه = شمارهٔ تلفن.
function normOwner(s: string) { return (s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() }

export async function GET(req: NextRequest) {
  // شناسه می‌تواند شمارهٔ تلفنِ مشاور یا کلیدِ مالکِ advisor-store باشد (مثل پیش‌نمایش نقش).
  const phone = (new URL(req.url).searchParams.get('phone') || '').trim()
  if (!phone) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })

  const a = await getAdvisor(phone)
  const p = a.profile
  // اگر مشاور هنوز هیچ اطلاعاتِ واقعی‌ای ثبت نکرده، پروفایلِ عمومی وجود ندارد.
  const acc = getAccount(phone)
  if (!(p.name || '').trim()) return NextResponse.json({ error: 'مشاور یافت نشد' }, { status: 404 })
  const stats = (await advisorStats(phone)).kpis
  const membership = await getAdvisorMembership(phone)

  // آگهی‌های عمومیِ این مشاور — فقط فایل‌های خودِ او، نه آگهی‌های سراسریِ سایت.
  // معیارِ مطمئن: شمارهٔ حسابِ مالک (هنگام انتشار روی آگهی مهر می‌خورد). فقط اگر هیچ
  // آگهیِ مهرخورده‌ای نبود، به‌عنوان جایگزین با نامِ نمایشی تطبیق می‌دهیم (دادهٔ قدیمی).
  const all = await listItems('listing', { publicOnly: true })
  const want = normOwner(p.name || '')
  let mine = all.filter(it => it.meta?.__ownerPhone === phone)
  if (mine.length === 0 && want) mine = all.filter(it => !it.meta?.__ownerPhone && normOwner(it.owner || '') === want)
  const listings = mine.slice(0, 12).map(it => ({ id: it.id, title: it.title, price: it.price, location: it.location, image: it.image }))

  return NextResponse.json({
    phone,
    name: p.name || acc?.name || 'مشاور املاک',
    title: p.title || 'مشاور املاک',
    bio: p.bio || '',
    contactPhone: '',            // شماره فقط با ورود از /api/listing-reveal دیده و ثبت می‌شود
    hasPhone: !!(p.phone),
    areas: p.areas || '',
    experience: p.experience || '',
    photo: p.photo || '',
    specialties: Array.isArray(p.specialties) ? p.specialties : [],
    agency: membership ? { name: membership.agencyName, phone: membership.agencyPhone } : null,
    stats: { activeListings: stats.activeListings, deals: stats.dealsThisMonth, totalListings: listings.length },
    listings,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
