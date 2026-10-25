// فاز ۳۲۴ — جستجوی فایل‌های واقعیِ سایت برای «دستیارِ ملک‌جت».
// از همان منبعِ آگهی‌های عمومی (listItems) + همان منطقِ معامله (dealOf) + لینکِ سئوِ آگهی استفاده
// می‌کند تا دستیار «همان فایل‌هایی که داریم» را نشان دهد — نه دادهٔ جعلی (قانونِ آهنین).
import { listItems, type Item } from './scraper-store'
import { dealOf } from './listing-filter'
import { listingHref } from './listing-url'
import { parseFaNum } from './reos/features'

export interface AssistantFilters {
  city?: string
  district?: string
  deal?: 'sale' | 'rent'        // خرید/فروش در برابرِ رهن‌واجاره
  type?: string                 // آپارتمان/ویلا/زمین/تجاری/دفتر…
  budgetMax?: number            // بیشترین قیمت (تومان) — برای خرید
  rooms?: number
  areaMin?: number
  areaMax?: number
}

export interface AssistantCard {
  id: string
  title: string
  price: string
  location: string
  image?: string
  url: string
  facts: string                 // «۱۲۰ متری · ۲ خواب · نوساز» — فقط از دادهٔ واقعی
}

const norm = (s?: string) => String(s || '').replace(/‌/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()

function imageOf(it: Item): string | undefined {
  if (it.image) return it.image
  const g = it.meta?.['__gallery']
  if (g) { const first = g.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)[0]; if (first) return first }
  return undefined
}

function factsOf(it: Item): string {
  const m = it.meta || {}
  const parts: string[] = []
  if (m['متراژ']) parts.push(`${parseFaNum(m['متراژ']).toLocaleString('fa-IR')} متری`)
  const rooms = parseFaNum(m['اتاق خواب'])
  if (rooms) parts.push(`${rooms.toLocaleString('fa-IR')} خواب`)
  if (m['سن بنا']) parts.push(String(m['سن بنا']))
  else if (/نوساز/.test(it.title || '')) parts.push('نوساز')
  if (m['طبقه']) parts.push(`طبقه ${m['طبقه']}`)
  return parts.slice(0, 3).join(' · ')
}

export function toCard(it: Item): AssistantCard {
  return {
    id: String(it.id),
    title: it.title || 'آگهی',
    price: it.price || '',
    location: it.location || [it.meta?.['شهر'], it.meta?.['محله']].filter(Boolean).join('، '),
    image: imageOf(it),
    url: listingHref(it.id, it.title, it.location, it.seoSlug),
    facts: factsOf(it),
  }
}

// امتیازِ تطبیق (۰..۱): چند شرطِ درخواستیِ کاربر واقعاً برآورده شده — برای مرتب‌سازی، نه نمایشِ عددِ جعلی.
function matchScore(it: Item, f: AssistantFilters): number {
  const m = it.meta || {}
  const hay = norm(`${it.title} ${it.location} ${m['شهر']} ${m['محله']} ${m['نوع ملک']}`)
  const haySp = hay.replace(/\s+/g, '')   // بدونِ فاصله: «جنت آباد» با «جنت‌آباد شمالی» هم می‌خورد
  let score = 0, want = 0
  if (f.city) { want++; if (hay.includes(norm(f.city))) score++ }
  if (f.district) { want++; if (haySp.includes(norm(f.district).replace(/\s+/g, ''))) score++ }
  if (f.type) { want++; if (hay.includes(norm(f.type))) score++ }
  if (f.deal) { want++; const d = dealOf(it); if ((f.deal === 'sale') === (d === 'sale')) score++ }
  if (f.budgetMax && dealOf(it) === 'sale') { want++; const p = parseFaNum(it.price); if (p && p <= f.budgetMax * 1.12) score += p <= f.budgetMax ? 1 : 0.5 }
  if (f.rooms) { want++; if (parseFaNum(m['اتاق خواب']) === f.rooms) score++ }
  if (f.areaMin || f.areaMax) { want++; const a = parseFaNum(m['متراژ']); if (a && (!f.areaMin || a >= f.areaMin) && (!f.areaMax || a <= f.areaMax)) score++ }
  return want ? score / want : 0.5
}

// آیا این آگهی «قطعاً بیرون از درخواست» است؟ (فیلترِ سختِ معامله/شهر/نوع تا نتیجهٔ بی‌ربط نیاید)
function hardPass(it: Item, f: AssistantFilters): boolean {
  if (f.deal) { const d = dealOf(it); if ((f.deal === 'sale') !== (d === 'sale')) return false }
  const hay = norm(`${it.title} ${it.location} ${it.meta?.['شهر']} ${it.meta?.['محله']} ${it.meta?.['نوع ملک']}`)
  if (f.city && !hay.includes(norm(f.city))) return false
  if (f.type && !hay.includes(norm(f.type))) return false
  // بودجه: فقط سقفِ سخت وقتی خرید و قیمتِ معلوم (با ۱۲٪ ارفاق)؛ آگهیِ بی‌قیمت رد نمی‌شود.
  if (f.deal === 'sale' && f.budgetMax && dealOf(it) === 'sale') { const p = parseFaNum(it.price); if (p && p > f.budgetMax * 1.12) return false }
  return true
}

// جستجوی فایل‌های واقعی با فیلترهای استخراج‌شده. خروجی: کارت‌های آمادهٔ نمایش در ویجت.
export async function searchAssistantListings(f: AssistantFilters, max = 4): Promise<AssistantCard[]> {
  let items: Item[] = []
  try { items = await listItems('listing', { publicOnly: true }) } catch { return [] }
  const pool = items.filter(it => hardPass(it, f))
  // مرتب‌سازی: ویژه اول، بعد بیشترین تطبیق، بعد تازه‌ترین.
  pool.sort((a, b) =>
    (b.featured ? 1 : 0) - (a.featured ? 1 : 0) ||
    matchScore(b, f) - matchScore(a, f) ||
    (b.firstSeenAt || b.scrapedAt) - (a.firstSeenAt || a.scrapedAt))
  return pool.slice(0, Math.max(1, Math.min(max, 8))).map(toCard)
}
