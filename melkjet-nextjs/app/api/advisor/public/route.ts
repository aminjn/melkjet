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
  let p = a.profile
  const acc = getAccount(phone)
  // اگر مشاور نیست ولی متخصصِ ثبت‌شدهٔ دیگری است (آژانس/سازنده/مصالح/حقوقی)، پروفایلِ
  // عمومی را از پروفایلِ کسب‌وکار می‌سازیم تا صفحهٔ /profile برای همهٔ متخصصان کار کند.
  if (!(p.name || '').trim()) {
    const { getProfile } = await import('@/app/lib/profile-store')
    const gp = getProfile(phone)
    const nm = (gp.businessName || gp.displayName || acc?.name || '').trim()
    if (!nm) return NextResponse.json({ error: 'متخصص یافت نشد' }, { status: 404 })
    p = { name: nm, title: gp.businessType || 'متخصص', bio: gp.about || gp.tagline || '', photo: gp.logo || '', areas: gp.city || '', experience: '', phone: gp.contactPhone || gp.landline || '', specialties: Array.isArray(gp.specialties) ? gp.specialties : [] }
  }
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

  // نشان‌های اعتبار — از همان سیگنال‌های واقعی (با کامل‌ترشدنِ دیتا خودکار فعال می‌شوند).
  const soldCount = mine.filter(it => { const ds = String(it.meta?.__dealStatus || ''); return ds === 'sold' || ds === 'rented' }).length
  const { computeRepBadges } = await import('@/app/lib/reputation')
  const badges = computeRepBadges({
    createdAt: acc?.createdAt,
    listingCount: mine.length,
    soldCount,
    profileComplete: !!((p.name || '').trim() && (p.photo || (p.specialties && p.specialties.length)) && p.phone),
    responsive: !!p.phone,
  })

  return NextResponse.json({
    badges,
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
