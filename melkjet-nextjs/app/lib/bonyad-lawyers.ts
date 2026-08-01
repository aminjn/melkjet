// فاز ۲۵۰ — اسکرپِ وکلای «حقوقیِ ملکی» از بنیاد وکلا (bonyadvokala.com) برای دایرکتوریِ متخصصان.
// به دستورِ کاربر «فقط تخصص‌های ملکی»: سایت خودش صفحه‌های تخصصیِ فیلترشده دارد، پس به‌جای کلِ
// ۴۷۰۰ وکیل فقط این ۴ صفحه (+صفحه‌بندی) را می‌گیریم — «فقط ملکی» به‌صورتِ ساختاری، نه فیلترِ حدسی.
// خروجی مستقیم در همان انبارِ scraper-store به‌عنوانِ آیتمِ directory/category='حقوقی' می‌نشیند و
// خودکار در /directory دیده می‌شود؛ dedup و آپدیتِ درجا از insertItems می‌آید (اسکرپِ مجدد = تازه‌سازی).
// سایت داخلی و بی‌فیلتر است → از shecan-https مستقیم می‌آید (مثل بقیهٔ سرویس‌های داخلی)، بی‌پروکسی.

import { shecanRequest } from './shecan-https'
import { addSource, insertItems, listItems, listSources, setModerationBatch, type Source } from './scraper-store'

const HOST = 'https://www.bonyadvokala.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const CAT = 'حقوقی'
const SOURCE_NAME = 'بنیاد وکلا — وکلای ملکی'

// چهار صفحهٔ تخصصیِ ملکی (از خودِ منویِ «تخصص» سایت کشف شد).
export const REALTY_SPECIALTIES: { path: string; label: string }[] = [
  { path: '/lawyers/وکیل-ملکی-و-املاک', label: 'ملکی و املاک' },
  { path: '/lawyers/وکیل-ثبت-اسناد-و-املاک', label: 'ثبت اسناد و املاک' },
  { path: '/lawyers/وکیل-قرارداد-و-تعهدات', label: 'قرارداد و تعهدات' },
  { path: '/lawyers/وکیل-ارث-و-وصیت', label: 'ارث و وصیت' },
]

const fa2en = (s: string) => (s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
const unent = (s: string) => (s || '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&zwnj;/g, '‌').trim()
const clean = (s: string) => unent(String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim()
const digits = (s: string) => fa2en(s).replace(/[^\d]/g, '')

export interface ParsedLawyer {
  slug: string
  extId: string          // acc_user_id — شناسهٔ عددیِ پایدارِ وکیل در بنیاد
  name: string
  url: string            // پروفایلِ تمیز (بی‌پارامترِ ردیابی)
  avatar: string
  city: string
  rating: string         // مثل «۴.۷» → «4.7»
  reviews: number
  services: number
  specialties: string[]
  channels: string[]     // «تلفنی» / «چت»
}

/** پارسِ خالصِ کارت‌های وکیل از HTMLِ یک صفحهٔ فهرست. تست‌پذیر روی HTMLِ واقعی. */
export function parseLawyerCards(html: string): ParsedLawyer[] {
  const out: ParsedLawyer[] = []
  // هر کارت یک <a ...class="lwv-card"...>…</a> است؛ لینکِ تودرتو ندارد پس تا اولین </a> بریده می‌شود.
  const cardRe = /<a\s+href="([^"]*\/lawyers\/[^"]+)"[\s\S]*?class="lwv-card[^"]*"([\s\S]*?)<\/a>/g
  for (const m of html.matchAll(cardRe)) {
    const href = unent(m[1])
    const body = m[2]
    const slug = (href.match(/\/lawyers\/([^?"#]+)/)?.[1] || '').trim()
    if (!slug || slug.startsWith('وکیل-')) continue   // خودِ صفحهٔ تخصص، نه یک وکیل
    const extId = href.match(/acc_user_id=(\d+)/)?.[1] || ''
    const name = clean(body.match(/lwv-card__name[^>]*>\s*<strong>([\s\S]*?)<\/strong>/)?.[1]
      || body.match(/<img[^>]*\balt="([^"]+)"/)?.[1] || '')
    if (!name) continue
    const avatar = unent(body.match(/<img[^>]*\bsrc="([^"]+)"/)?.[1] || '')
    const city = clean(body.match(/li-mappin[\s\S]*?<\/svg>\s*([^<]+?)\s*<\/span>/)?.[1] || '')
    const rating = fa2en(body.match(/lwv-card__rate[^>]*>[\s\S]*?<b>\s*([\d۰-۹.]+)\s*<\/b>/)?.[1] || '').trim()
    const reviews = Number(digits(body.match(/\(\s*([\d۰-۹,،]+)\s*نظر/)?.[1] || '')) || 0
    const services = Number(digits(body.match(/([\d۰-۹,،]+)\s*خدمت/)?.[1] || '')) || 0
    const topicsBlock = body.match(/lwv-card__topics[^>]*>([\s\S]*?)<\/div>/)?.[1] || ''
    const specialties = Array.from(topicsBlock.matchAll(/<span>\s*([^<]+?)\s*<\/span>/g)).map(t => clean(t[1])).filter(Boolean)
    const chanBlock = body.match(/lwv-card__chan[^>]*>([\s\S]*?)<\/div>/)?.[1] || ''
    const channels = Array.from(chanBlock.matchAll(/<span[^>]*lwv-chan[^>]*>\s*([^<]+?)\s*<\/span>/g)).map(c => clean(c[1])).filter(Boolean)
    out.push({ slug, extId, name, url: `${HOST}/lawyers/${slug}`, avatar, city, rating, reviews, services, specialties, channels })
  }
  return out
}

async function fetchPage(path: string): Promise<{ status: number; html: string }> {
  try {
    const r = await shecanRequest(`${HOST}${path}`, {
      method: 'GET',
      headers: { 'user-agent': UA, accept: 'text/html', 'accept-language': 'fa,en;q=0.8' },
      timeout: 20000,
    })
    return { status: r.status, html: r.status === 200 ? (r.body || '') : '' }
  } catch {
    return { status: 0, html: '' }
  }
}

/** منبعِ ثابتِ بنیاد وکلا در انبار (idempotent — اگر بود همان، وگرنه ساخته می‌شود). */
async function ensureSource(): Promise<Source> {
  const found = (await listSources()).find(s => s.name === SOURCE_NAME)
  if (found) return found
  return addSource({ name: SOURCE_NAME, url: `${HOST}/lawyers`, type: 'directory', category: CAT, method: 'css', enabled: true, schedule: 'manual' })
}

export interface ScrapeResult { found: number; added: number; updated: number; pages: number; byCity: Record<string, number>; note?: string }

/** اسکرپِ کاملِ وکلای ملکی: ۴ تخصص × صفحه‌بندی → dedup روی extId (اتحادِ تخصص‌ها) → درجِ انبار. */
export async function scrapeBonyadLawyers(opts?: { maxPagesPerSpecialty?: number }): Promise<ScrapeResult> {
  const maxPages = Math.max(1, Math.min(60, opts?.maxPagesPerSpecialty || 40))
  const byId = new Map<string, ParsedLawyer>()   // extId||slug → وکیل (اتحادِ تخصص‌ها بینِ صفحه‌های تخصصی)
  let pages = 0
  let firstErr = ''
  for (const sp of REALTY_SPECIALTIES) {
    for (let p = 1; p <= maxPages; p++) {
      const { status, html } = await fetchPage(`${sp.path}${p > 1 ? `?page=${p}` : ''}`)
      pages++
      if (status !== 200 || !html) { if (!firstErr) firstErr = `«${sp.label}» صفحهٔ ${p}: HTTP ${status || 'شبکه'}`; break }
      const cards = parseLawyerCards(html)
      if (!cards.length) break   // صفحهٔ خالی = پایانِ صفحه‌بندیِ این تخصص
      for (const c of cards) {
        const key = c.extId || c.slug
        const prev = byId.get(key)
        if (prev) {
          // اتحادِ تخصص‌ها + نگه‌داشتِ کامل‌ترین داده
          const specs = new Set([...prev.specialties, ...c.specialties, sp.label])
          prev.specialties = Array.from(specs)
        } else {
          const specs = new Set([...c.specialties, sp.label])
          byId.set(key, { ...c, specialties: Array.from(specs) })
        }
      }
      await new Promise(r => setTimeout(r, 400))   // مهربان با سرورِ منبع
    }
  }
  const lawyers = Array.from(byId.values())
  if (!lawyers.length) return { found: 0, added: 0, updated: 0, pages, byCity: {}, note: firstErr || 'هیچ کارتی پارس نشد — ساختارِ سایت شاید عوض شده.' }

  const source = await ensureSource()
  const raw = lawyers.map(l => ({
    title: l.name,
    location: l.city,
    image: l.avatar,
    url: l.url,
    excerpt: `وکیل پایه یک دادگستری${l.rating ? ` · امتیاز ${l.rating}` : ''}${l.reviews ? ` (${l.reviews.toLocaleString('fa-IR')} نظر)` : ''}${l.services ? ` · ${l.services.toLocaleString('fa-IR')} خدمت` : ''}`,
    rating: l.rating || undefined,
    tags: l.specialties.slice(0, 6),
    owner: l.name,
  }))
  const res = await insertItems(source, raw)

  // دایرکتوریِ حرفه‌ای، ریسکِ کلاهبرداریِ آگهی‌مانند ندارد → تأییدِ خودکار (نه صفِ ممیزیِ انسانی).
  const mine = (await listItems('directory')).filter(i => i.sourceId === source.id && i.status === 'pending')
  if (mine.length) await setModerationBatch(mine.map(i => ({ id: i.id, status: 'approved' as const, reason: 'دایرکتوریِ حرفه‌ای — بنیاد وکلا', score: 90 })))

  const byCity: Record<string, number> = {}
  for (const l of lawyers) { const c = l.city.split(/[،,]/)[0].trim() || 'نامشخص'; byCity[c] = (byCity[c] || 0) + 1 }
  return { found: lawyers.length, added: res.added, updated: res.updated, pages, byCity }
}

/** پروبِ debug — یک صفحه می‌گیرد و پارسِ خام را برمی‌گرداند (سند، نه ادعا). */
export async function debugBonyadScrape(): Promise<{ ok: boolean; status: number; sample: ParsedLawyer[]; count: number; note?: string }> {
  const sp = REALTY_SPECIALTIES[0]
  const { status, html } = await fetchPage(sp.path)
  if (status !== 200) return { ok: false, status, sample: [], count: 0, note: `دسترسی به بنیاد وکلا ناموفق (HTTP ${status || 'شبکه'}).` }
  const cards = parseLawyerCards(html)
  return { ok: cards.length > 0, status, sample: cards.slice(0, 3), count: cards.length, note: cards.length ? undefined : 'صفحه گرفته شد ولی کارتی پارس نشد.' }
}

/** شمارشِ وکلای اسکرپ‌شدهٔ فعلی (برای کارتِ ادمین). */
export async function bonyadLawyerCount(): Promise<number> {
  const items = await listItems('directory')
  return items.filter(i => i.sourceName === SOURCE_NAME).length
}
