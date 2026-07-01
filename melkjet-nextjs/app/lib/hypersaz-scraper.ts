import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { upsertScraped, type CatalogSpec } from './catalog-store'

// موتورِ اسکرپِ hypersaz.com → کاتالوگِ مرجع.
// استراتژیِ اصلی: WooCommerce Store API (اکثرِ فروشگاه‌های وردپرسیِ ایرانی) — JSON تمیز،
// بدونِ نیاز به پارسِ HTML. اگر در دسترس نبود، خطا برمی‌گرداند تا selectorها روی سرور تنظیم شود.
const BASE = process.env.HYPERSAZ_BASE || 'https://www.hypersaz.com'
const JOB_FILE = join(process.cwd(), '.hypersaz-job.json')

export interface ScrapeJob {
  running: boolean; total: number; done: number; added: number; updated: number; categories: number
  label?: string; error?: string; startedAt?: number; finishedAt?: number; lastProgressAt?: number
}
const EMPTY: ScrapeJob = { running: false, total: 0, done: 0, added: 0, updated: 0, categories: 0 }

function loadJob(): ScrapeJob { if (existsSync(JOB_FILE)) { try { return { ...EMPTY, ...JSON.parse(readFileSync(JOB_FILE, 'utf-8')) } } catch {} } return { ...EMPTY } }
function saveJob(j: ScrapeJob) { try { writeFileSync(JOB_FILE, JSON.stringify(j)) } catch {} }
export function getJob(): ScrapeJob {
  const j = loadJob()
  // اگر بیش از ۳ دقیقه پیشرفتی نبوده، کهنه است.
  if (j.running) { const last = j.lastProgressAt || j.startedAt || 0; if (!last || Date.now() - last > 3 * 60 * 1000) { j.running = false; j.error = j.error || 'اسکرپ متوقف شد (هنگ یا ری‌استارت).'; saveJob(j) } }
  return j
}
export function stopJob(): ScrapeJob { const j = loadJob(); j.running = false; j.finishedAt = Date.now(); j.error = 'به‌صورتِ دستی متوقف شد.'; saveJob(j); return j }
function patch(p: Partial<ScrapeJob>) { const j = { ...loadJob(), ...p, lastProgressAt: Date.now() }; saveJob(j); return j }

const UA = 'Mozilla/5.0 (compatible; MelkjetBot/1.0)'
async function getJson(url: string, timeoutMs = 20000): Promise<any> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ac.signal, cache: 'no-store' as any })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const total = Number(r.headers.get('x-wp-totalpages') || r.headers.get('X-WP-TotalPages') || 0)
    const data = await r.json()
    return { data, totalPages: total }
  } finally { clearTimeout(t) }
}

function stripHtml(s: string): string { return (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim() }

// از attributes/short_description مشخصاتِ فنی بساز (WooCommerce Store API: attributes[]).
function specsFrom(prod: any): CatalogSpec[] {
  const out: CatalogSpec[] = []
  const attrs = Array.isArray(prod.attributes) ? prod.attributes : []
  for (const a of attrs) {
    const key = String(a.name || '').trim()
    const vals = Array.isArray(a.terms) ? a.terms.map((t: any) => t.name).filter(Boolean).join('، ') : ''
    if (key && vals) out.push({ key: key.slice(0, 60), value: vals.slice(0, 120) })
  }
  return out.slice(0, 20)
}

// اجرای واقعیِ اسکرپ (WooCommerce Store API). صفحه‌به‌صفحه محصولات را می‌آورد.
async function run() {
  patch({ running: true, done: 0, added: 0, updated: 0, categories: 0, error: undefined, startedAt: Date.now(), finishedAt: undefined, label: 'خواندنِ دسته‌بندی‌ها' })
  try {
    // دسته‌بندی‌ها (برای شمارش/نگاشت نام)
    const catMap = new Map<number, string>()
    try {
      const { data: cats } = await getJson(`${BASE}/wp-json/wc/store/v1/products/categories?per_page=100`)
      if (Array.isArray(cats)) for (const c of cats) catMap.set(c.id, String(c.name || '').trim())
      patch({ categories: catMap.size })
    } catch { /* دسته‌ها بعداً از خودِ محصول ساخته می‌شوند */ }

    // محصولات صفحه‌به‌صفحه
    let page = 1, totalPages = 1
    const first = await getJson(`${BASE}/wp-json/wc/store/v1/products?per_page=50&page=1`)
    if (!Array.isArray(first.data)) throw new Error('پاسخِ Store API نامعتبر است — احتمالاً سایت WooCommerce نیست یا مسیر فرق دارد.')
    totalPages = Math.max(1, first.totalPages || 1)
    patch({ total: totalPages * 50, label: 'اسکرپِ محصولات' })

    const ingest = async (list: any[]) => {
      const items = list.map((p: any) => {
        const catName = (Array.isArray(p.categories) && p.categories[0]?.name) ? String(p.categories[0].name) : (catMap.get((Array.isArray(p.categories) && p.categories[0]?.id) || 0) || 'دسته‌بندی‌نشده')
        return {
          name: String(p.name || '').trim(),
          categoryName: catName,
          image: (Array.isArray(p.images) && p.images[0]?.src) ? String(p.images[0].src) : undefined,
          description: stripHtml(p.short_description || p.description || '').slice(0, 800),
          specs: specsFrom(p),
          externalId: String(p.id || ''),
          externalUrl: p.permalink ? String(p.permalink) : undefined,
        }
      }).filter(x => x.name)
      const res = upsertScraped(items)
      const j = loadJob()
      patch({ added: j.added + res.added, updated: j.updated + res.updated })
    }

    await ingest(first.data)
    patch({ done: 50 })

    for (page = 2; page <= totalPages; page++) {
      if (!loadJob().running) break   // توقفِ دستی
      try {
        const { data } = await getJson(`${BASE}/wp-json/wc/store/v1/products?per_page=50&page=${page}`)
        if (Array.isArray(data) && data.length) await ingest(data)
      } catch { /* یک صفحهٔ خطادار کلِ کار را متوقف نکند */ }
      patch({ done: page * 50 })
    }

    const fin = loadJob()
    patch({ running: false, finishedAt: Date.now(), total: fin.done, label: 'پایان' })
  } catch (e: any) {
    patch({ running: false, finishedAt: Date.now(), error: e?.message || 'خطا در اسکرپِ هایپرساز' })
  }
}

// شروعِ پس‌زمینه (fire-and-forget). فقط اگر کاری در حال اجرا نیست.
export function startBackgroundScrape(): { started: boolean } {
  const j = getJob()
  if (j.running) return { started: false }
  patch({ running: true, startedAt: Date.now(), error: undefined })
  run().catch(err => patch({ running: false, error: String(err?.message || err) }))
  return { started: true }
}
