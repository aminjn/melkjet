import { createHash } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'

// ── دروازهٔ «اول ماشین‌لرنینگ، بعد AI، و یادگیری از AI» ────────────────────────────
// لایهٔ مشترکی که هر مصرف‌کنندهٔ AI با آن بسته‌بندی می‌شود تا سه پله را رایگان بگیرد:
//   (۱) حافظهٔ دقیق: اگر همین ورودی قبلاً پاسخ گرفته → همان پاسخ، بدونِ AI.
//   (۲) مدلِ آموخته (اختیاری): اگر مدلِ محلی مطمئن بود → پاسخِ آن، بدونِ AI.
//   (۳) پناه به AI: فقط وقتی دو پلهٔ بالا نتوانستند → AI، و بلافاصله پاسخش کش + به مدل آموخته می‌شود.
// هدف: هر بار که یک کار تکرار می‌شود، سهمِ AI کمتر و کمترشود («کم‌شدنِ AI» قابلِ‌اندازه‌گیری).
//
// امن: هیچ رفتاری را عوض نمی‌کند مگر جایی که صریحاً صدا زده شود. پاسخِ نامعتبر کش نمی‌شود.

const FILE = join(process.cwd(), '.ml-gateway-data.json')
const KV = 'ml_gateway'
const MAX_ENTRIES = 8000   // سقفِ کش تا بلاب بزرگ نشود (هرس: قدیمی‌ترین‌ها حذف)

interface CacheEntry { v: unknown; at: number; hits: number }
interface Stat { cache: number; model: number; ai: number }
interface GwData { cache: Record<string, CacheEntry>; stats: Record<string, Stat> }
const empty = (): GwData => ({ cache: {}, stats: {} })

function fileLoad(): GwData { if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { cache: d.cache || {}, stats: d.stats || {} } } catch {} } return empty() }
function fileSave(d: GwData) { try { writeFileSync(FILE, JSON.stringify(d), 'utf-8') } catch {} }
async function load(): Promise<GwData> { return pgEnabled() ? await kvGet<GwData>(KV, empty()) : fileLoad() }
async function mutate<R>(fn: (d: GwData) => R): Promise<R> { if (pgEnabled()) return kvMutate<GwData, R>(KV, empty(), fn); const d = fileLoad(); const r = fn(d); fileSave(d); return r }

const hashOf = (task: string, key: string) => task + ':' + createHash('sha256').update(String(key)).digest('hex').slice(0, 24)
function prune(d: GwData) {
  const keys = Object.keys(d.cache)
  if (keys.length <= MAX_ENTRIES) return
  keys.sort((a, b) => (d.cache[a].at || 0) - (d.cache[b].at || 0))
  for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete d.cache[k]
}
function bump(d: GwData, task: string, via: keyof Stat) { const s = d.stats[task] || (d.stats[task] = { cache: 0, model: 0, ai: 0 }); s[via]++ }

export interface MlFirstOpts<T> {
  task: string                                   // فضای‌نامِ کار (برای کش و آمار)
  key: string                                    // ورودیِ یکتا (هش می‌شود) — «همان ورودی = همان جواب»
  ai: () => Promise<T>                            // پلهٔ ۳: fallbackِ AI
  ttlMs?: number                                 // عمرِ کش (پیش‌فرض: بی‌نهایت — برای کارهای معیّن)
  predict?: () => { value: T; confident: boolean } | null | undefined   // پلهٔ ۲: مدلِ آموختهٔ محلی
  learn?: (value: T) => void | Promise<void>     // بعد از AI: به مدل یاد بده تا دفعهٔ بعد خودش بداند
  validate?: (value: T) => boolean               // جوابِ AI معتبر است؟ (نامعتبر کش/آموخته نمی‌شود)
}
export interface MlFirstResult<T> { value: T; via: 'cache' | 'model' | 'ai' }

// هستهٔ سه‌پله. برمی‌گرداند پاسخ + اینکه از کدام پله آمد (برای سنجشِ «سهمِ AI»).
export async function mlFirst<T>(o: MlFirstOpts<T>): Promise<MlFirstResult<T>> {
  const h = hashOf(o.task, o.key)
  // پلهٔ ۱ — حافظهٔ دقیق
  const d0 = await load()
  const hit = d0.cache[h]
  if (hit && (!o.ttlMs || Date.now() - hit.at < o.ttlMs)) {
    mutate(d => { const e = d.cache[h]; if (e) { e.hits++; } bump(d, o.task, 'cache') }).catch(() => {})
    return { value: hit.v as T, via: 'cache' }
  }
  // پلهٔ ۲ — مدلِ آموخته
  if (o.predict) {
    try {
      const p = o.predict()
      if (p && p.confident) {
        await mutate(d => { d.cache[h] = { v: p.value, at: Date.now(), hits: 0 }; prune(d); bump(d, o.task, 'model') })
        return { value: p.value, via: 'model' }
      }
    } catch { /* مدل خطا داد → می‌رویم AI */ }
  }
  // پلهٔ ۳ — AI + یادگیری
  const value = await o.ai()
  const ok = o.validate ? (() => { try { return o.validate!(value) } catch { return false } })() : true
  if (ok) {
    try { await o.learn?.(value) } catch { /* یادگیری نباید مسیر را بشکند */ }
    await mutate(d => { d.cache[h] = { v: value, at: Date.now(), hits: 0 }; prune(d); bump(d, o.task, 'ai') })
  } else {
    await mutate(d => bump(d, o.task, 'ai'))
  }
  return { value, via: 'ai' }
}

// آمارِ «سهمِ هر پله» برای هر کار — تا در گزارشِ سلامت ببینیم AI چقدر کم شده.
export async function gatewayStats(): Promise<Record<string, Stat & { total: number; mlPct: number }>> {
  const d = await load()
  const out: Record<string, Stat & { total: number; mlPct: number }> = {}
  for (const [task, s] of Object.entries(d.stats)) {
    const total = s.cache + s.model + s.ai
    out[task] = { ...s, total, mlPct: total ? Math.round(((s.cache + s.model) / total) * 100) : 0 }
  }
  return out
}

export async function gatewayCacheSize(): Promise<number> { return Object.keys((await load()).cache).length }
export async function resetGateway(): Promise<void> { await mutate(d => { d.cache = {}; d.stats = {} }) }
