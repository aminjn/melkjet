import { createHash } from 'crypto'
import { existsSync, mkdirSync, writeFileSync } from './fs-atomic'
import { join } from 'path'

// کشِ محلیِ عکسِ آگهی.
//
// آدرس‌های CDN دیوار پایدار نیستند: بخشِ میانیِ مسیر امضای هر گونه است (نسخهٔ post و
// thumbnail یک UUID مشترک دارند ولی امضای متفاوت)، و آگهی که پاک یا منقضی شود عکسش
// هم می‌رود. ۳۱ اوت ۲۰۲۶: از ۲۵ نمونهٔ تصادفیِ ذخیره‌شده، هر ۲۵ تا ۴۰۴ می‌دادند —
// چه تازه چه قدیمی. تا وقتی مستقیم به دیوار لینک بدهیم، هر آگهی دیر یا زود بی‌عکس
// می‌شود، هرچقدر هم دادهٔ دیگرش کامل باشد.
//
// عمداً از media-store استفاده نمی‌شود: فهرستش سقفِ ۲۰۰۰ ردیف دارد و هر ذخیره کلِ
// فایلِ فهرست را بازنویسی می‌کند. برای ۱۷ هزار عکس هر دو مشکل‌سازند. اینجا نام از
// هشِ آدرسِ مبدأ ساخته می‌شود، پس نه فهرستی لازم است نه بازنویسی‌ای — و چون نام
// ثابت است، کشِ مرورگر می‌تواند immutable باشد.

const DIR = join(process.cwd(), '.media', 'li')
const MAX_BYTES = 3 * 1024 * 1024

export function localName(url: string): string {
  const h = createHash('sha1').update(url).digest('hex').slice(0, 20)
  const m = /\.(jpe?g|png|webp|gif)(\?|$)/i.exec(url)
  const ext = (m?.[1] || 'webp').toLowerCase().replace('jpeg', 'jpg')
  return `${h}.${ext}`
}

export function localUrl(url: string): string { return '/api/li/' + localName(url) }

export function isCached(url: string): boolean {
  try { return existsSync(join(DIR, localName(url))) } catch { return false }
}

// مسیرِ فایلِ کش‌شده برای مسیرِ سِرو — نام اعتبارسنجی می‌شود تا از عبور از پوشه جلوگیری شود.
export function cachedPath(name: string): string | null {
  if (!/^[a-f0-9]{20}\.(jpg|png|webp|gif)$/.test(name)) return null
  const p = join(DIR, name)
  try { return existsSync(p) ? p : null } catch { return null }
}

// یک‌بار می‌گیرد و محلی می‌کند. خروجی: آدرسِ محلی، یا رشتهٔ خالی اگر نشد.
export async function cacheRemote(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) return ''
  const name = localName(url)
  try { if (existsSync(join(DIR, name))) return '/api/li/' + name } catch {}
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) return ''
    if (!/^image\//i.test(r.headers.get('content-type') || '')) return ''
    const buf = Buffer.from(await r.arrayBuffer())
    if (!buf.length || buf.length > MAX_BYTES) return ''
    if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
    writeFileSync(join(DIR, name), buf)
    return '/api/li/' + name
  } catch { return '' }
}
