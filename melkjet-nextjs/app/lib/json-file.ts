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
