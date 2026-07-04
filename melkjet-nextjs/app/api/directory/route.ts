import { NextRequest, NextResponse } from 'next/server'
import { listAccounts } from '@/app/lib/account-store'
import { listRoles } from '@/app/lib/role-store'
import { getProfile } from '@/app/lib/profile-store'
import { getAdvisor } from '@/app/lib/advisor-store'

// دایرکتوریِ متخصصانِ «ثبت‌شده در سایت» — تا کاربران واقعیِ نقش‌دار (مشاور/آژانس/سازنده/
// مصالح/حقوقی) در دایرکتوری دیده شوند و به پروفایلِ عمومی‌شان لینک شوند.
// نگاشتِ نامِ نقش → دستهٔ دایرکتوری:
const ROLE_CAT: Record<string, string> = {
  'مشاور املاک': 'مشاور',
  'آژانس املاک': 'آژانس',
  'سازنده / انبوه‌ساز': 'سازنده',
  'تأمین‌کنندهٔ مصالح': 'مصالح',
  'مشاور حقوقی': 'حقوقی',
}

export async function GET(req: NextRequest) {
  const category = (new URL(req.url).searchParams.get('category') || '').trim()
  const roles = listRoles()
  const roleName = (rid?: string) => { if (!rid) return ''; const r = roles.find(x => x.id === rid || x.name === rid); return r?.name || rid }

  const items: any[] = []
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
      scrapedAt: a.createdAt || 0, status: 'approved', registered: true,
    })
  }
  // تازه‌ترها / کامل‌ترها اول (آن‌هایی که عکس یا تخصص دارند).
  items.sort((x, y) => (Number(!!y.image) - Number(!!x.image)) || (y.scrapedAt - x.scrapedAt))
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store, private' } })
}
