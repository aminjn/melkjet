import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listItems, type Item } from '@/app/lib/scraper-store'
import { listingHref } from '@/app/lib/listing-url'
import { myArea } from '@/app/lib/reos/my-area'
import { areaCells, itemCell, DEAL_RENT } from '@/app/lib/reos/area-stats'

// GET /api/reos/role-feed?role=… — فایل‌های پیشنهادی برای مشاور/آژانس.
//
// چرا موتورِ رتبه‌بندیِ رفتاری اینجا استفاده نمی‌شود: آن موتور روی demand/engagement
// می‌چیند، و کلِ جدولِ listing-stats سی رکورد با میانهٔ یک بازدید دارد. مرتب‌کردنِ
// ۹۰۰۰ آگهی بر اساسِ کلیدی که برای همه صفر است، ترتیب را دست‌نخورده برمی‌گرداند —
// برای همین «داغ» و «تازه» یک لیستِ یکسان بودند. تا وقتی ترافیکِ واقعی نداریم،
// این پنل روی تنها چیزی می‌ایستد که واقعاً داریم: قیمتِ ۹۴۸۲ فایلِ ثبت‌شده.
const fa = (n: number) => Math.round(n).toLocaleString('fa-IR')
const M = (n: number) => fa(n / 1e6)
const K = (n: number) => fa(n / 1e3)
const DAY = 864e5

type Card = {
  id: string; score: number; matchPct: number; reasons: string[]; why: string[]
  listing: { title: string; price: string; image?: string; location: string; deal: string; href: string } | null
}

const disp = (it: Item) => ({
  title: it.title, price: it.price || '',
  image: it.image || (typeof it.meta?.__gallery === 'string' ? String(it.meta.__gallery).split('\n')[0] : undefined),
  location: it.location || '', deal: String(it.meta?.['نوع معامله'] || ''),
  href: listingHref(it.id, it.title, it.location),
})

/** اولین باری که آگهی دیده شده. scrapedAt در هر به‌روزرسانی ریست می‌شود، پس تنها
 *  وقتی «تازگی» معنا دارد که مهرِ اولین‌بار موجود باشد. */
const firstSeen = (it: Item): number => Number(it.meta?.__firstSeenAt) || 0

export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const phone = String(s.phone)
  const role = new URL(req.url).searchParams.get('role') || 'buyer'
  const H = { headers: { 'Cache-Control': 'no-store, private' } }

  const mine = await myArea(phone)
  if (!mine.hoods.length) {
    return NextResponse.json({
      ok: true, role, label: 'فایل‌های پیشنهادی', scoped: false, sections: [],
      note: 'هنوز محلهٔ کاری‌ای برای شما ثبت نشده. با ثبتِ چند فایل، پیشنهادها به همان محله‌ها محدود می‌شود — تا آن‌وقت فهرستِ سراسری نشان نمی‌دهیم چون به کارِ شما نمی‌آید.',
    }, H)
  }

  const items = await listItems('listing', { publicOnly: true })
  const hoods = new Set(mine.hoods), cities = new Set(mine.cities)
  const cells = await areaCells({ hoods: mine.hoods, minSamples: 5, items })
  const med = new Map(cells.map(c => [[c.city, c.hood, c.deal, c.ptype].join('|'), c]))

  const pool: Array<{ it: Item; hood: string; deal: string; perM: number; delta: number | null; n: number; mid: number }> = []
  for (const it of items) {
    if (String(it.ownerId || '') === phone) continue          // فایلِ خودِ کاربر پیشنهاد نیست
    const c = itemCell(it)
    if (!c) continue
    if (!hoods.has(c.hood)) continue
    if (cities.size && c.city && !cities.has(c.city)) continue // «شهرک غرب» در دو شهر وجود دارد
    const cell = med.get([c.city, c.hood, c.deal, c.ptype].join('|'))
    const mid = cell?.medianPerM || 0
    pool.push({ it, hood: c.hood, deal: c.deal, perM: c.perM,
      delta: mid > 0 ? (c.perM - mid) / mid : null, n: cell?.listings || 0, mid })
  }

  const unit = (deal: string, v: number) => deal === DEAL_RENT ? `${K(v)} هزار/متر` : `${M(v)} م/متر`

  // ── زیرِ قیمتِ محله: تنها سنجهٔ فرصت که دادهٔ واقعی پشتش هست.
  const value: Card[] = pool
    .filter(x => x.delta !== null && x.delta <= -0.05)
    .sort((a, b) => (a.delta as number) - (b.delta as number))
    .slice(0, 12)
    .map(x => {
      const pct = Math.round(Math.abs(x.delta as number) * 100)
      return {
        id: x.it.id, score: Math.min(1, pct / 40), matchPct: pct,
        reasons: [`${fa(pct)}٪ زیرِ میانهٔ ${x.hood}`, `میانهٔ ${x.hood}: ${unit(x.deal, x.mid)} از ${fa(x.n)} فایل`],
        why: [], listing: disp(x.it),
      }
    })
    .map(c => ({ ...c, why: c.reasons }))

  // ── تازه‌ثبت‌شده: فقط بر پایهٔ مهرِ «اولین‌بار». اگر نداریم، سبد خالی می‌ماند.
  const now = Date.now()
  const fresh: Card[] = pool
    .filter(x => { const t = firstSeen(x.it); return t > 0 && now - t <= 7 * DAY })
    .sort((a, b) => firstSeen(b.it) - firstSeen(a.it))
    .slice(0, 12)
    .map(x => {
      const days = Math.max(0, Math.round((now - firstSeen(x.it)) / DAY))
      const r = [days <= 0 ? `امروز در ${x.hood} ثبت شد` : `${fa(days)} روز پیش در ${x.hood} ثبت شد`]
      if (x.delta !== null) r.push(`${fa(Math.abs(x.delta) * 100)}٪ ${x.delta < 0 ? 'زیرِ' : 'بالای'} میانهٔ محله`)
      return { id: x.it.id, score: 1 - days / 7, matchPct: days,
        reasons: r, why: r, listing: disp(x.it) }
    })

  const sections = [
    { key: 'value', label: `زیرِ قیمتِ محله‌های شما`, icon: '◈', cards: value, pctSuffix: '٪ زیرِ میانه' },
    { key: 'fresh', label: 'تازه‌ثبت‌شده در محله‌های شما', icon: '✦', cards: fresh, pctSuffix: ' روز پیش' },
  ].filter(sec => sec.cards.length > 0)

  return NextResponse.json({
    ok: true, role, label: 'فایل‌های پیشنهادی', scoped: true,
    myHoods: mine.hoods, pool: pool.length, sections,
    note: sections.length ? undefined
      : `در ${fa(mine.hoods.length)} محلهٔ کاریِ شما فعلاً فایلی با قیمتِ زیرِ میانه یا ثبتِ هفتهٔ اخیر نیست.`,
  }, H)
}
