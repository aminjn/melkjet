import { NextRequest, NextResponse } from 'next/server'
import { listAccounts } from '@/app/lib/account-store'
import { listRoles } from '@/app/lib/role-store'
import { getProfile } from '@/app/lib/profile-store'
import { allApprovedReviews } from '@/app/lib/reviews-store'
import { allAdvisorProfilesLean } from '@/app/lib/advisor-store'
import { FA_DIGITS, faDigit } from '@/app/lib/digits'
import { canonCat } from '@/app/lib/directory-cats'

// دایرکتوریِ متخصصانِ «ثبت‌شده در سایت» — تا کاربران واقعیِ نقش‌دار (مشاور/آژانس/سازنده/
// مصالح/حقوقی) در دایرکتوری دیده شوند و به پروفایلِ عمومی‌شان لینک شوند.
// نگاشتِ نامِ نقش → دستهٔ دایرکتوری:
// سازنده جدا از این نگاشت است: مستقیم از پرشین‌سازه با لینکِ درستِ /builders/{id} می‌آید،
// نه از اکانت‌ها با لینکِ /profile (که صفحهٔ خالی بود).
const ROLE_CAT: Record<string, string> = {
  'مشاور املاک': 'مشاور',
  'آژانس املاک': 'آژانس',
  'تأمین‌کنندهٔ مصالح': 'مصالح',
  'مشاور حقوقی': 'حقوقی',
  // متخصصانِ خدماتی (نقش‌های تازه) → دستهٔ دایرکتوری، مطابقِ منوی «متخصصان» در Nav.
  'معمار و طراح داخلی': 'معمار',
  'پیمانکار': 'پیمانکار',
  'کارشناس رسمی': 'کارشناس',
  'دفتر حقوقی': 'حقوقی',
  'بانک و بیمه': 'بیمه',
  'دفترخانه': 'دفترخانه',
}

// فاز ۱۳۲ — کشِ درون‌حافظه‌ایِ ۶۰ثانیه‌ای: بدونِ آن، هر بازدید/کلیکِ دسته = اسکنِ کاملِ اکانت‌ها +
// پرشین‌سازه (~۶MB) + آگهی‌ها؛ روی prod چند ثانیه طول می‌کشید («خیلی طول می‌کشد لود کند»).
// فاز ۲۸۹ — کشِ «کهنه بده، در پس‌زمینه تازه کن»: کاربر هیچ‌وقت پشتِ ساختِ فهرست نمی‌ماند؛
// فقط اولین درخواستِ هر اینستنس بعد از ری‌استارت هزینهٔ ساخت را می‌دهد.
const DIR_TTL = 5 * 60_000
const dirCache = new Map<string, { at: number; body: any }>()
const dirInflight = new Set<string>()
async function dirCached(key: string, build: () => Promise<any>): Promise<any> {
  const hit = dirCache.get(key)
  if (hit) {
    if (Date.now() - hit.at > DIR_TTL && !dirInflight.has(key)) {
      dirInflight.add(key)
      build().then(b => dirCache.set(key, { at: Date.now(), body: b })).catch(() => {}).finally(() => dirInflight.delete(key))
    }
    return hit.body
  }
  const b = await build()
  dirCache.set(key, { at: Date.now(), body: b })
  return b
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const category = (url.searchParams.get('category') || '').trim()
  const roles = listRoles()
  const roleName = (rid?: string) => { if (!rid) return ''; const r = roles.find(x => x.id === rid || x.name === rid); return r?.name || rid }

  // فاز ۱۳۰ — شمارشِ واقعیِ هر دسته برای سایدبارِ دایرکتوری (اکانت‌های نقش‌دار + سازنده‌های پرشین‌سازه + اسکرپ)
  if (url.searchParams.get('counts') === '1') {
    const body = await dirCached('counts', async () => {
    const counts: Record<string, number> = {}
    for (const a of listAccounts()) {
      const cat = ROLE_CAT[roleName(a.role)]
      if (!cat) continue
      const p = getProfile(a.phone)
      if (!(p.businessName || p.displayName || a.name || '').trim()) continue
      counts[cat] = (counts[cat] || 0) + 1
    }
    try {
      const { getProfiles } = await import('@/app/lib/persiansaze-store')
      counts['سازنده'] = (counts['سازنده'] || 0) + Object.values(getProfiles()).filter((b: any) => b?.name).length
    } catch {}
    try {
      const { listItems } = await import('@/app/lib/scraper-store')
      for (const it of await listItems('directory', { publicOnly: true })) {
        const c = canonCat(String((it as any).category || ''))   // دستهٔ هم‌معنی/برچسب‌کامل زیرِ کلیدِ canonical شمرده شود
        if (c) counts[c] = (counts[c] || 0) + 1
      }
    } catch {}
    return { counts }
    })
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store, private' } })
  }

  const body = await dirCached('cat:' + category, async () => {
  const items: any[] = []
  // فاز ۱۳۲ — یک خواندن برای همه: پروفایل‌های مشاور (قبلاً برای هر مشاور یک کوئریِ PG!) و نظراتِ تأییدشده
  const advisors132 = await allAdvisorProfilesLean().catch(() => ({} as Awaited<ReturnType<typeof allAdvisorProfilesLean>>))
  const reviewsByOwner = new Map<string, { n: number; rated: number; sum: number }>()
  for (const r of allApprovedReviews()) {
    const cur = reviewsByOwner.get(r.ownerPhone) || { n: 0, rated: 0, sum: 0 }
    cur.n++
    if (Number(r.rating) >= 1) { cur.rated++; cur.sum += Number(r.rating) }
    reviewsByOwner.set(r.ownerPhone, cur)
  }

  // شمارشِ آگهی‌ها و معاملاتِ موفق به‌ازای هر مالک — سیگنالِ نشان‌های اعتبار (یک‌بار خوانده می‌شود).
  const listingAgg = new Map<string, { count: number; sold: number }>()
  try {
    const { listItems } = await import('@/app/lib/scraper-store')
    for (const it of await listItems('listing', { publicOnly: true })) {
      const ph = String((it as any).meta?.__ownerPhone || '').replace(FA_DIGITS, faDigit).replace(/\D/g, '')
      if (!ph) continue
      const a = listingAgg.get(ph) || { count: 0, sold: 0 }
      a.count++
      const ds = String((it as any).meta?.__dealStatus || '')
      if (ds === 'sold' || ds === 'rented') a.sold++
      listingAgg.set(ph, a)
    }
  } catch { /* اسکرپر در دسترس نبود */ }
  const { computeRepBadges } = await import('@/app/lib/reputation')

  // ── سازنده‌ها: مستقیم از دیتابیسِ پرشین‌سازه، با لینکِ درستِ /builders/{constructorId} ──
  if (!category || category === 'سازنده') {
    try {
      const { getProfiles, regionLabel } = await import('@/app/lib/persiansaze-store')
      const { allBuilderReviewStats } = await import('@/app/lib/builder-public-store')
      const { allBuilderSlugsById } = await import('@/app/lib/builder-slug-store')   // فاز ۲۹۸ی۲ — لینکِ canonicalِ اسلاگی (نه idِ عددیِ ریدایرکتی)
      const bStats292 = allBuilderReviewStats()   // فاز ۲۹۲ — امتیازِ نظراتِ تاییدشدهٔ سازنده‌ها (یک خواندن)
      const bSlugs = await allBuilderSlugsById().catch(() => ({} as Record<string, string>))
      const profs = getProfiles()
      for (const key in profs) {
        const b = profs[key]
        if (!b || !b.name) continue
        const region = (b.regions && b.regions.length) ? regionLabel({ cityId: 1, regionId: b.regions[0] }) : ''
        const pc = Number(b.projectCount) || 0
        const brv = bStats292.get(String(b.id))
        items.push({
          id: b.id, sourceName: 'ملک‌جت', type: 'directory', category: 'سازنده',
          title: b.name, location: region, image: '',
          excerpt: pc ? `${pc.toLocaleString('fa-IR')} پروژه` : '',
          tags: pc ? [`${pc.toLocaleString('fa-IR')} پروژه`] : [],
          hasPhone: !!(b.phone || (b.phones && b.phones.length)),
          stats: { projects: pc, rating: brv?.avg || 0, reviews: brv?.count || 0 },   // فاز ۱۳۰/۲۹۲ — پروژه‌ها و امتیازِ واقعی
          url: `/builders/${encodeURIComponent(bSlugs[String(b.id)] || b.id)}`,   // اسلاگِ canonical؛ fallback به id
          revealKind: 'builder', revealId: String(b.id),   // شمارهٔ سازنده از /api/contact-reveal
          scrapedAt: 0, status: 'approved', registered: true,
        })
      }
    } catch { /* پرشین‌سازه در دسترس نبود */ }
  }
  for (const a of listAccounts()) {
    const cat = ROLE_CAT[roleName(a.role)]
    if (!cat) continue                                   // فقط نقش‌های متخصص
    if (category && category !== cat) continue
    const p = getProfile(a.phone)
    let name = (p.businessName || p.displayName || a.name || '').trim()
    let photo = p.logo || ''
    let specialties = Array.isArray(p.specialties) ? p.specialties : []
    let city = p.city || ''
    let tagline = p.tagline || p.businessType || ''
    let hasPhone = !!(p.contactPhone || p.landline)
    // غنی‌سازیِ مشاور از advisor-store (نام/عکس/تخصص/منطقه).
    if (cat === 'مشاور') {
      try {
        const ap = advisors132[a.phone]
        if (ap) {
          if (!name && ap.name) name = ap.name.trim()
          if (!photo && ap.photo) photo = ap.photo
          if (!specialties.length && Array.isArray(ap.specialties)) specialties = ap.specialties
          if (!city && ap.areas) city = ap.areas
          if (!tagline && ap.title) tagline = ap.title
          if (ap.phone) hasPhone = true
        }
      } catch {}
    }
    if (!name) continue                                  // بدونِ نام، در دایرکتوری نیاور
    // سیگنال‌های اعتبار → نشان‌های اکتسابی (با کامل‌ترشدنِ دیتا خودکار فعال می‌شوند).
    const norm = String(a.phone || '').replace(FA_DIGITS, faDigit).replace(/\D/g, '')
    const agg = listingAgg.get(norm) || { count: 0, sold: 0 }
    const badges = computeRepBadges({
      createdAt: a.createdAt,
      listingCount: agg.count,
      soldCount: agg.sold,
      profileComplete: !!(name && (photo || specialties.length) && hasPhone),
      responsive: hasPhone,
    })
    // فاز ۱۳۰ — آمارِ واقعیِ کارت (هیچ عددی ساختگی نیست): نظرها/امتیاز از نظراتِ تأییدشده، معامله از آگهی‌های فروخته/اجاره‌رفته، عضویت از createdAt
    const rv = reviewsByOwner.get(String(a.phone).replace(FA_DIGITS, faDigit).replace(/\D/g, '')) || { n: 0, rated: 0, sum: 0 }
    const avgRating = rv.rated ? Math.round(rv.sum / rv.rated * 10) / 10 : 0
    const memberYears = a.createdAt ? Math.max(0, Math.floor((Date.now() - a.createdAt) / (365.25 * 864e5))) : 0
    items.push({
      id: a.phone, sourceName: 'ملک‌جت', type: 'directory', category: cat,
      title: name, location: city, image: photo, excerpt: tagline,
      tags: specialties.slice(0, 4), hasPhone, url: `/profile/${encodeURIComponent(a.phone)}`,
      badges,
      verified: !!p.verified,   // فاز ۲۹۲ — تیکِ آبیِ ملک‌جت (پولی، از پنلِ ادمین)
      stats: { reviews: rv.n, rating: avgRating, deals: agg.sold, listings: agg.count, memberYears, memberSince: a.createdAt || 0 },
      // شماره از /api/listing-reveal با kind=advisor — برای هر اکانت (مشاور یا غیرِ آن) خودِ
      // شمارهٔ اکانت را برمی‌گرداند (اگر پروفایلِ مشاور نباشد). شناسه = تلفنِ اکانت.
      revealKind: 'advisor', revealId: a.phone,
      scrapedAt: a.createdAt || 0, status: 'approved', registered: true,
    })
  }
  // فاز ۲۵۰ — آیتم‌های دایرکتوریِ اسکرپ‌شده (مثلِ وکلای ملکیِ بنیاد وکلا) — میزبانی در ملک‌جت با
  // لینکِ بیرونی به منبع برای پروفایلِ کامل (کاربر انتخابِ «فهرست + لینک به منبع» را کرد).
  try {
    const { listItems } = await import('@/app/lib/scraper-store')
    for (const it of await listItems('directory', { publicOnly: true })) {
      const cat = canonCat(it.category) || 'حقوقی'   // برچسب‌کامل/هم‌معنی → کلیدِ canonical
      if (category && canonCat(category) !== cat) continue
      items.push({
        id: it.id, sourceName: it.sourceName || 'منبعِ بیرونی', type: 'directory', category: cat,
        title: it.title, location: it.location || '', image: it.image || '',
        excerpt: it.excerpt || '', tags: (it.tags || []).slice(0, 4),
        hasPhone: false, url: it.url || '', external: !!(it.url && /^https?:\/\//.test(it.url)),
        stats: it.rating ? { rating: Number(it.rating) } : undefined,
        scrapedAt: it.scrapedAt || 0, status: 'approved', registered: false,
      })
    }
  } catch { /* اسکرپر در دسترس نبود */ }

  // نشان‌گذاریِ «ویژه» برای پروفایل‌های دارای پروموتِ فعال (خودسرویس).
  try {
    const { promotedProfileInfo } = await import('@/app/lib/promotion-store')
    const promoted = await promotedProfileInfo()
    const norm = (p?: string) => String(p || '').replace(FA_DIGITS, faDigit).replace(/\D/g, '')
    for (const it of items) { const info = promoted.get(norm(it.revealId || it.id)); it.promoted = !!info; if (info) it.promoKind = info.kind || 'ویژه' }
  } catch { /* پروموت در دسترس نبود */ }
  // ویژه‌ها اول، سپس تازه‌ترها / کامل‌ترها (عکس‌دار/تخصص‌دار).
  items.sort((x, y) => (Number(!!y.promoted) - Number(!!x.promoted)) || (Number(!!y.image) - Number(!!x.image)) || (y.scrapedAt - x.scrapedAt))
  // فاز ۲۹۸ض — توزیعِ امتیازِ این دسته را کش کن تا صفحهٔ پروفایل بتواند «جزوِ N٪ برتر» را
  // از جامعهٔ واقعیِ همان صنف نشان دهد. فقط دستهٔ مشخص و وقتی دادهٔ کافی هست.
  if (category) {
    try {
      const { dirItemScore, computeDist } = await import('@/app/lib/provider-score')
      const { kvSet, pgEnabled } = await import('@/app/lib/db')
      const dist = computeDist(items.map(it => dirItemScore(it).score))
      if (pgEnabled() && dist.count >= 8) await kvSet('scoredist:' + category, dist)
    } catch { /* توزیع اختیاری است */ }
  }
  return { items }
  })
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store, private' } })
}
