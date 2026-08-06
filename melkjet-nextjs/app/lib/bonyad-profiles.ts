// فاز ۲۵۱ — پروفایلِ کاملِ داخلیِ وکلای بنیاد وکلا: پارسِ صفحهٔ پروفایل + انبارِ جدا (کلید=slug)
// + واکشیِ درخواستیِ کش‌شونده. عمداً جدا از scraper-store: دادهٔ غنی (آرایهٔ دیدگاه‌ها/stats/بیو)
// در Item.meta (فقط Record<string,string>) جا نمی‌شود و نباید سقفِ ۱۰۰۰ آیتمِ انبارِ مشترک را بخورد.
// همهٔ فیلدها روی HTMLِ واقعیِ یک پروفایل تست و تأیید شده‌اند (ld+json + سه بلوکِ HTML).

import { promises as fs } from 'fs'
import { join } from 'path'
import { shecanRequest } from './shecan-https'

const HOST = 'https://www.bonyadvokala.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const STORE = join(process.cwd(), '.bonyad-profiles.json')
const TTL = 7 * 24 * 3600 * 1000   // پروفایل هر ۷ روز تازه می‌شود

// helperهای مشترک (هم‌سبک با bonyad-lawyers.ts)
const fa2en = (s: string) => (s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
const unent = (s: string) => (s || '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&zwnj;/g, '‌').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim()

export interface ProfileReview { author: string; rating: number; body: string }
export interface ProfileStat { label: string; value: number }
export interface LawyerProfile {
  slug: string
  name: string
  jobTitle: string
  avatar: string
  city: string
  specialties: string[]
  rating: string            // «4.7»
  ratingCount: number       // ۴۵۹
  reviews: ProfileReview[]
  bio: string[]             // هر خط = یک پاراگراف
  stats: ProfileStat[]      // گزارش عملکرد
  startingPrice: number     // تومان (۰ اگر نبود)
  sourceUrl: string
  fetchedAt: number
}

/** پارسِ خالصِ HTMLِ صفحهٔ پروفایل → LawyerProfile. تست‌پذیر روی HTMLِ واقعی. */
export function parseLawyerProfile(html: string, slug: string): LawyerProfile | null {
  // ۱) ld+json: Person + LegalService (منبعِ ساخت‌یافتهٔ نام/عنوان/آواتار/شهر/تخصص/امتیاز/دیدگاه)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let person: any = null, service: any = null
  for (const m of html.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let j: any
    try { j = JSON.parse(m[1]) } catch { continue }
    for (const n of (j['@graph'] || [j])) {
      if (n && n['@type'] === 'Person') person = n
      if (n && n['@type'] === 'LegalService') service = n
    }
  }
  const name = person?.name || unent((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '').replace(/<[^>]+>/g, ' '))
  if (!name) return null

  // ۲) بیو «درباره من» → آرایهٔ خطوطِ تمیز
  const rawBio = html.match(/class="content truncatable[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] || ''
  const bio = unent(rawBio.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/\r/g, '').split('\n').map(s => s.replace(/[ \t]+/g, ' ').trim()).filter(Boolean)

  // ۳) قیمتِ شروع — «شروع از <b>۵۹۹,۰۰۰</b> تومان» (فقط رقمِ فارسی تا کلاسِ CSS مثل text-gray-800 رد شود)
  const priceStr = fa2en(html.match(/شروع از[\s\S]{0,120}?([۰-۹][۰-۹,،٬]*)[\s\S]{0,20}?تومان/)?.[1] || '').replace(/[،,٬]/g, '')
  const startingPrice = Number(priceStr) || 0

  // ۴) گزارش عملکرد (stats): جفت‌های [عدد, برچسب] پس از «آخرین بروزرسانی … پیش»
  const sb = html.match(/id="stats"[\s\S]*?(?=<div[^>]*rounded shadow|<\/main>|<footer)/)?.[0] || ''
  const lines = sb.replace(/<[^>]+>/g, '\n').split('\n').map(unent).filter(Boolean)
  const stats: ProfileStat[] = []
  let i = lines.findIndex(l => /پیش/.test(l)); i = i < 0 ? 0 : i + 1
  for (; i < lines.length - 1; i++) {
    const v = fa2en(lines[i]).replace(/[،,]/g, '')
    if (/^\d+$/.test(v)) {
      const label = lines[i + 1]
      if (label && !/^\d/.test(fa2en(label))) { stats.push({ label, value: Number(v) }); i++ }
    }
  }

  return {
    slug,
    name: unent(name),
    jobTitle: person?.jobTitle || 'وکیل پایه یک دادگستری',
    avatar: person?.image || '',
    city: person?.address?.addressLocality || '',
    specialties: Array.isArray(person?.knowsAbout) ? person.knowsAbout : [],
    rating: String(service?.aggregateRating?.ratingValue || ''),
    ratingCount: Number(service?.aggregateRating?.ratingCount) || 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reviews: Array.isArray(service?.review) ? service.review.map((r: any) => ({
      author: unent(r?.author?.name || ''), rating: Number(r?.reviewRating?.ratingValue) || 0, body: unent(r?.reviewBody || ''),
    })).filter((r: ProfileReview) => r.body) : [],
    bio,
    stats,
    startingPrice,
    sourceUrl: `${HOST}/lawyers/${slug}`,
    fetchedAt: Date.now(),
  }
}

// ── انبارِ فایلیِ کوچک (کلید = slug) ──
type Store = Record<string, LawyerProfile>
async function readStore(): Promise<Store> {
  try { return JSON.parse(await fs.readFile(STORE, 'utf8')) as Store } catch { return {} }
}
async function writeStore(s: Store): Promise<void> {
  await fs.writeFile(STORE, JSON.stringify(s), 'utf8')
}

async function fetchProfileHtml(slug: string): Promise<string> {
  try {
    const r = await shecanRequest(`${HOST}/lawyers/${slug}`, {
      method: 'GET',
      headers: { 'user-agent': UA, accept: 'text/html', 'accept-language': 'fa,en;q=0.8' },
      timeout: 20000,
    })
    return r.status === 200 ? (r.body || '') : ''
  } catch { return '' }
}

/** پروفایلِ کش‌شونده: تازه بود همان؛ وگرنه واکشی+پارس+ذخیره. کشِ کهنه بهتر از هیچ اگر شبکه قطع بود. */
export async function getLawyerProfile(slug: string, opts?: { force?: boolean }): Promise<LawyerProfile | null> {
  const store = await readStore()
  const cached = store[slug]
  if (!opts?.force && cached && Date.now() - cached.fetchedAt < TTL) return cached
  const html = await fetchProfileHtml(slug)
  if (!html) return cached || null
  const parsed = parseLawyerProfile(html, slug)
  if (!parsed) return cached || null
  const fresh = await readStore()   // merge تازه تا نوشتنِ هم‌زمانِ slugِ دیگر گم نشود
  fresh[slug] = parsed
  await writeStore(fresh).catch(() => {})
  return parsed
}

/** خواندنِ سریعِ کش بدونِ واکشیِ شبکه (برای مسیرهای حساس‌به‌تأخیر). */
export async function getCachedProfile(slug: string): Promise<LawyerProfile | null> {
  return (await readStore())[slug] || null
}
