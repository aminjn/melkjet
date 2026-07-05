import { NextRequest, NextResponse } from 'next/server'
import { listAccounts } from '@/app/lib/account-store'
import { listRoles } from '@/app/lib/role-store'
import { getProfile } from '@/app/lib/profile-store'
import { getAdvisor } from '@/app/lib/advisor-store'

// دایرکتوریِ متخصصانِ «ثبت‌شده در سایت» — تا کاربران واقعیِ نقش‌دار (مشاور/آژانس/سازنده/
// مصالح/حقوقی) در دایرکتوری دیده شوند و به پروفایلِ عمومی‌شان لینک شوند.
// نگاشتِ نامِ نقش → دستهٔ دایرکتوری:
// سازنده جدا از این نگاشت است: مستقیم از پرشین‌سازه با لینکِ درستِ /sazande/{id} می‌آید،
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

export async function GET(req: NextRequest) {
  const category = (new URL(req.url).searchParams.get('category') || '').trim()
  const roles = listRoles()
  const roleName = (rid?: string) => { if (!rid) return ''; const r = roles.find(x => x.id === rid || x.name === rid); return r?.name || rid }

  const items: any[] = []

  // ── سازنده‌ها: مستقیم از دیتابیسِ پرشین‌سازه، با لینکِ درستِ /sazande/{constructorId} ──
  if (!category || category === 'سازنده') {
    try {
      const { getProfiles, regionLabel } = await import('@/app/lib/persiansaze-store')
      const profs = getProfiles()
      for (const key in profs) {
        const b = profs[key]
        if (!b || !b.name) continue
        const region = (b.regions && b.regions.length) ? regionLabel({ cityId: 1, regionId: b.regions[0] }) : ''
        const pc = Number(b.projectCount) || 0
        items.push({
          id: b.id, sourceName: 'ملک‌جت', type: 'directory', category: 'سازنده',
          title: b.name, location: region, image: '',
          excerpt: pc ? `${pc.toLocaleString('fa-IR')} پروژه` : '',
          tags: pc ? [`${pc.toLocaleString('fa-IR')} پروژه`] : [],
          hasPhone: !!(b.phone || (b.phones && b.phones.length)),
          url: `/sazande/${encodeURIComponent(b.id)}`,
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
        const ap = (await getAdvisor(a.phone)).profile
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
    items.push({
      id: a.phone, sourceName: 'ملک‌جت', type: 'directory', category: cat,
      title: name, location: city, image: photo, excerpt: tagline,
      tags: specialties.slice(0, 4), hasPhone, url: `/profile/${encodeURIComponent(a.phone)}`,
      // شماره از /api/listing-reveal با kind=advisor — برای هر اکانت (مشاور یا غیرِ آن) خودِ
      // شمارهٔ اکانت را برمی‌گرداند (اگر پروفایلِ مشاور نباشد). شناسه = تلفنِ اکانت.
      revealKind: 'advisor', revealId: a.phone,
      scrapedAt: a.createdAt || 0, status: 'approved', registered: true,
    })
  }
  // نشان‌گذاریِ «ویژه» برای پروفایل‌های دارای پروموتِ فعال (خودسرویس).
  try {
    const { promotedProfilePhones } = await import('@/app/lib/promotion-store')
    const promoted = promotedProfilePhones()
    const norm = (p?: string) => String(p || '').replace(/\D/g, '')
    for (const it of items) it.promoted = promoted.has(norm(it.revealId || it.id))
  } catch { /* پروموت در دسترس نبود */ }
  // ویژه‌ها اول، سپس تازه‌ترها / کامل‌ترها (عکس‌دار/تخصص‌دار).
  items.sort((x, y) => (Number(!!y.promoted) - Number(!!x.promoted)) || (Number(!!y.image) - Number(!!x.image)) || (y.scrapedAt - x.scrapedAt))
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store, private' } })
}
