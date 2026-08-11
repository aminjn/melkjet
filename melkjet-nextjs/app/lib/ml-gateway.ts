import { createHash } from 'crypto'

// ── دروازهٔ «اول ماشین‌لرنینگ، بعد AI، و یادگیری از AI» ────────────────────────────
// لایهٔ مشترکی که هر مصرف‌کنندهٔ AI با آن بسته‌بندی می‌شود تا سه پله را رایگان بگیرد:
//   (۱) حافظهٔ دقیق: اگر همین ورودی قبلاً پاسخ گرفته → همان پاسخ، بدونِ AI.
//   (۲) مدلِ آموخته (اختیاری): اگر مدلِ محلی مطمئن بود → پاسخِ آن، بدونِ AI.
//   (۳) پناه به AI: فقط وقتی دو پلهٔ بالا نتوانستند → AI، و پاسخش کش می‌شود.
//
// ⚡ کش «در حافظه» است (per-instance)، نه در PostgreSQL — چون خواندن/نوشتنِ یک بلابِ واحد
// در هر درخواست، poolِ PG را اشباع و کلِ سایت (حتی بارگذاریِ اولیه) را کند می‌کرد. کش فقط
// یک بهینه‌سازی است؛ per-instance بودن و پاک‌شدن با ری‌استارت هیچ ضرری ندارد.

const MAX_ENTRIES = 5000   // سقفِ کشِ حافظه‌ای؛ سرریز → حذفِ قدیمی‌ترین‌ها

interface CacheEntry { v: unknown; at: number; hits: number }
interface Stat { cache: number; model: number; ai: number }
const CACHE = new Map<string, CacheEntry>()
const STATS: Record<string, Stat> = {}

const hashOf = (task: string, key: string) => task + ':' + createHash('sha256').update(String(key)).digest('hex').slice(0, 24)
function prune() {
  if (CACHE.size <= MAX_ENTRIES) return
  // Map حافظه‌اش ترتیبِ درج را نگه می‌دارد؛ قدیمی‌ترین‌ها اولِ iterator هستند.
  let drop = CACHE.size - MAX_ENTRIES
  for (const k of CACHE.keys()) { CACHE.delete(k); if (--drop <= 0) break }
}
function bump(task: string, via: keyof Stat) { const s = STATS[task] || (STATS[task] = { cache: 0, model: 0, ai: 0 }); s[via]++ }

export interface MlFirstOpts<T> {
  task: string                                   // فضای‌نامِ کار (برای کش و آمار)
  key: string                                    // ورودیِ یکتا (هش می‌شود) — «همان ورودی = همان جواب»
  ai: () => Promise<T>                            // پلهٔ ۳: fallbackِ AI
  ttlMs?: number                                 // عمرِ کش (پیش‌فرض: بی‌نهایت)
  predict?: () => { value: T; confident: boolean } | null | undefined   // پلهٔ ۲: مدلِ آموختهٔ محلی
  learn?: (value: T) => void | Promise<void>     // بعد از AI: به مدل یاد بده
  validate?: (value: T) => boolean               // جوابِ AI معتبر است؟ (نامعتبر کش/آموخته نمی‌شود)
}
export interface MlFirstResult<T> { value: T; via: 'cache' | 'model' | 'ai' }

// هستهٔ سه‌پله. برمی‌گرداند پاسخ + اینکه از کدام پله آمد (برای سنجشِ «سهمِ AI»).
export async function mlFirst<T>(o: MlFirstOpts<T>): Promise<MlFirstResult<T>> {
  const h = hashOf(o.task, o.key)
  // پلهٔ ۱ — حافظهٔ دقیق (Mapِ درون‌حافظه، بدونِ I/O)
  const hit = CACHE.get(h)
  if (hit && (!o.ttlMs || Date.now() - hit.at < o.ttlMs)) { hit.hits++; bump(o.task, 'cache'); return { value: hit.v as T, via: 'cache' } }
  // پلهٔ ۲ — مدلِ آموخته
  if (o.predict) {
    try {
      const p = o.predict()
      if (p && p.confident) { CACHE.set(h, { v: p.value, at: Date.now(), hits: 0 }); prune(); bump(o.task, 'model'); return { value: p.value, via: 'model' } }
    } catch { /* مدل خطا داد → می‌رویم AI */ }
  }
  // پلهٔ ۳ — AI + یادگیری
  const value = await o.ai()
  const ok = o.validate ? (() => { try { return o.validate!(value) } catch { return false } })() : true
  if (ok) { try { await o.learn?.(value) } catch { /* یادگیری مسیر را نشکند */ } CACHE.set(h, { v: value, at: Date.now(), hits: 0 }); prune() }
  bump(o.task, 'ai')
  return { value, via: 'ai' }
}

// آمارِ «سهمِ هر پله» برای هر کار (per-instance؛ با ری‌استارت صفر می‌شود).
export async function gatewayStats(): Promise<Record<string, Stat & { total: number; mlPct: number }>> {
  const out: Record<string, Stat & { total: number; mlPct: number }> = {}
  for (const [task, s] of Object.entries(STATS)) {
    const total = s.cache + s.model + s.ai
    out[task] = { ...s, total, mlPct: total ? Math.round(((s.cache + s.model) / total) * 100) : 0 }
  }
  return out
}

export async function gatewayCacheSize(): Promise<number> { return CACHE.size }
export async function resetGateway(): Promise<void> { CACHE.clear(); for (const k of Object.keys(STATS)) delete STATS[k] }
