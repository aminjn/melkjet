import { NextRequest, NextResponse } from 'next/server'
import { getAccount } from '@/app/lib/account-store'
import { getAdvisor, advisorStats } from '@/app/lib/advisor-store'
import { getAdvisorMembership } from '@/app/lib/agency-link-store'
import { listItems } from '@/app/lib/scraper-store'

// دادهٔ عمومیِ یک مشاور برای صفحهٔ پابلیک پروفایل. شناسه = شمارهٔ تلفن.
function normOwner(s: string) { return (s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() }

export async function GET(req: NextRequest) {
  const phone = (new URL(req.url).searchParams.get('phone') || '').replace(/\D/g, '')
  if (!phone) return NextResponse.json({ error: 'شماره الزامی است' }, { status: 400 })
  const acc = getAccount(phone)
  if (!acc) return NextResponse.json({ error: 'مشاور یافت نشد' }, { status: 404 })

  const a = getAdvisor(phone)
  const p = a.profile
  const stats = advisorStats(phone).kpis
  const membership = getAdvisorMembership(phone)

  // آگهی‌های عمومیِ منتشرشدهٔ این مشاور (بر اساس نام آگهی‌دهنده)
  const want = normOwner(p.name || '')
  const listings = want
    ? listItems('listing', { publicOnly: true })
      .filter(it => normOwner(it.owner || '') === want)
      .slice(0, 12)
      .map(it => ({ id: it.id, title: it.title, price: it.price, location: it.location, image: it.image }))
    : []

  return NextResponse.json({
    phone,
    name: p.name || acc.name || 'مشاور املاک',
    title: p.title || 'مشاور املاک',
    bio: p.bio || '',
    contactPhone: p.phone || '',
    areas: p.areas || '',
    experience: p.experience || '',
    photo: p.photo || '',
    specialties: Array.isArray(p.specialties) ? p.specialties : [],
    agency: membership ? { name: membership.agencyName, phone: membership.agencyPhone } : null,
    stats: { activeListings: stats.activeListings, deals: stats.dealsThisMonth, totalListings: listings.length },
    listings,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
