import { readFileSync, writeFileSync, statSync } from 'fs'

// ── لایهٔ کشِ فایل‌های JSON (کلیدِ عملکرد) ────────────────────────────────────
// مشکل: هر store روی هر عملیات کلِ فایل را readFileSync+JSON.parse می‌کرد. برای فایل‌های
// بزرگ (پرشین‌سازه ~۲۰هزار پروژه) و پرخوان (account/role در هر درخواست) این CPU را می‌سوزاند.
// راه‌حل: تا وقتی فایل تغییر نکرده (mtime+size یکسان)، از حافظه بخوان و دوباره parse نکن.
// بینِ چند اینستنسِ pm2 امن است: هر خواندن یک statSync می‌زند؛ اگر اینستنسِ دیگری نوشته باشد
// mtime عوض شده و دوباره از دیسک خوانده می‌شود (یک syscall به‌جای parse چند مگابایتی).

interface Entry { mtimeMs: number; size: number; data: unknown }
const cache = new Map<string, Entry>()

export function readJsonCached<T>(file: string, fallback: T): T {
  let st
  try { st = statSync(file) } catch { return fallback }   // فایل وجود ندارد
  const hit = cache.get(file)
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.data as T
  try {
    const data = JSON.parse(readFileSync(file, 'utf-8'))
    cache.set(file, { mtimeMs: st.mtimeMs, size: st.size, data })
    return data as T
  } catch { return fallback }
}

export function writeJsonCached(file: string, data: unknown, pretty = false): void {
  writeFileSync(file, pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data), 'utf-8')
  try { const st = statSync(file); cache.set(file, { mtimeMs: st.mtimeMs, size: st.size, data }) } catch { cache.delete(file) }
}

// باطل‌کردنِ دستیِ کش (به‌ندرت لازم است — مثلاً حذفِ کاملِ فایل).
export function invalidateJsonCache(file?: string): void { if (file) cache.delete(file); else cache.clear() }

// ── فاز ۲۴۱ — قفلِ بین‌پروسه‌ایِ read-modify-write ─────────────────────────────
// ریشهٔ «رفعِ تعلیق می‌زنم دوباره معلق می‌شود»: ۴ اینستنسِ pm2 هم‌زمان روی یک فایل
// load→mutate→save می‌کردند و نوشتهٔ دیرتر، تغییراتِ نوشتهٔ زودتر را کامل می‌بلعید
// (کرانِ گیتِ پروفایل در یک پاس صدها نوشتن دارد — هر نوشتهٔ ادمین وسطش قربانی می‌شد).
// قفل: ساختِ انحصاریِ فایلِ ‎.lock‎ (openSync 'wx' — اتمیکِ سیستم‌عاملی)؛ قفلِ یتیمِ
// کرش‌شده بعد از ۵۰۰ms شکسته می‌شود؛ خطای غیرمنتظرهٔ قفل هرگز سرویس را نمی‌خواباند.
import { openSync, closeSync, unlinkSync } from 'fs'
export function withFileLock<R>(file: string, fn: () => R): R {
  const lock = file + '.lock'
  const start = Date.now()
  for (;;) {
    let fd: number | null = null
    try { fd = openSync(lock, 'wx') } catch (e) {
      if ((e as { code?: string })?.code !== 'EEXIST') return fn()   // فایل‌سیستمِ عجیب → بدونِ قفل ادامه بده
      if (Date.now() - start > 500) { try { unlinkSync(lock) } catch {} ; continue }   // قفلِ یتیم
      const until = Date.now() + 4
      while (Date.now() < until) { /* انتظارِ کوتاه؛ نوشتن‌ها میلی‌ثانیه‌ای‌اند */ }
      continue
    }
    try { return fn() } finally { try { closeSync(fd) } catch {} ; try { unlinkSync(lock) } catch {} }
  }
}

/** خواندنِ تازه از دیسک (برای داخلِ قفل — کش فقط به‌روزرسانی می‌شود، میان‌بر نمی‌زند). */
export function readJsonFresh<T>(file: string, fallback: T): T {
  try {
    const data = JSON.parse(readFileSync(file, 'utf-8'))
    try { const st = statSync(file); cache.set(file, { mtimeMs: st.mtimeMs, size: st.size, data }) } catch {}
    return data as T
  } catch { return fallback }
}
