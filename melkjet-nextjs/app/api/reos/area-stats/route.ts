import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { areaCells, priceGuide } from '@/app/lib/reos/area-stats'
import { listListings } from '@/app/lib/advisor-store'
import { getAgency } from '@/app/lib/agency-store'

// GET /api/reos/area-stats            → آمارِ محله‌هایی که خودِ کاربر در آن‌ها فایل دارد
// GET /api/reos/area-stats?all=1      → کلِ بازار (وقتی کاربر صریحاً بخواهد)
// GET /api/reos/area-stats?guide=1&city=&hood=&deal=&ptype=&area=  → راهنمای قیمت

/** محله‌هایی که این کاربر واقعاً در آن‌ها کار می‌کند — از فایل‌های خودش. */
async function myHoods(phone: string): Promise<{ hoods: string[]; cities: string[] }> {
  const hoods = new Set<string>(), cities = new Set<string>()
  const push = (h?: string, c?: string) => { if (h?.trim()) hoods.add(h.trim()); if (c?.trim()) cities.add(c.trim()) }
  try { for (const l of await listListings(phone)) push(l.neighborhood || l.district, l.city) } catch { /* مشاور نیست */ }
  try { for (const l of (await getAgency(phone)).listings || []) push(l.neighborhood || l.district, l.city) } catch { /* آژانس نیست */ }
  return { hoods: [...hoods], cities: [...cities] }
}

export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const sp = new URL(req.url).searchParams

  if (sp.get('guide') === '1') {
    const guide = await priceGuide({
      city: sp.get('city') || undefined,
      hood: sp.get('hood') || undefined,
      deal: sp.get('deal') || 'فروش',
      ptype: sp.get('ptype') || 'آپارتمان',
      area: Number(sp.get('area')) || undefined,
    })
    return NextResponse.json({ ok: true, guide }, { headers: { 'Cache-Control': 'no-store, private' } })
  }

  const wantAll = sp.get('all') === '1'
  const mine = await myHoods(String(s.phone))
  // اگر کاربر هنوز فایلی ندارد، به‌جای صفحهٔ خالی کلِ بازار را می‌دهیم و صریح اعلام می‌کنیم.
  const scoped = !wantAll && mine.hoods.length > 0
  const cells = await areaCells(scoped ? { hoods: mine.hoods, minSamples: 5 } : { minSamples: 8 })
  return NextResponse.json(
    { ok: true, scoped, myHoods: mine.hoods, myCities: mine.cities, cells: cells.slice(0, 120) },
    { headers: { 'Cache-Control': 'no-store, private' } },
  )
}
