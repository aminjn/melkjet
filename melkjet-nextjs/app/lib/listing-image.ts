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

// turbopackIgnore: .media holds ~52k cached images. Left analysable, Turbopack
// folds this join() into a literal directory and every later join(DIR, x) becomes a
// glob over it - the build reported one pattern matching 210,504 files, and compile
// time went from 2.2min to 4.9min as the cache grew. Nothing here is a module; it is
// runtime data, so there is nothing for the bundler to trace.
const DIR = join(/*turbopackIgnore: true*/ process.cwd(), '.media', 'li')
const MAX_BYTES = 3 * 1024 * 1024

// کلیدِ کش تا ۷ سپتامبر ۲۰۲۶ sha1(کلِ آدرس) بود — و همین دیسک را پر کرد.
// آدرسِ CDN دیوار امضادار است: بخشِ میانیِ مسیر هر بار عوض می‌شود ولی UUIDِ آخر پایدار
// می‌ماند (همان چیزی که کامنتِ بالا می‌گوید: post و thumbnail یک UUID مشترک دارند).
// پس هر بار که یک آگهی دوباره اسکرپ می‌شد، هشِ تازه‌ای ساخته می‌شد، فایلِ تازه‌ای نوشته
// می‌شد و نسخهٔ قبلی برای همیشه یتیم می‌ماند: ۵۰٬۳۶۹ فایلِ مرده و ۴٫۳ گیگابایت در دو
// هفته. دیسک به ۹۸٪ رسید، کوئری‌ها تایم‌اوت خوردند و پنل صفر کاربر نشان داد.
// حالا کلید = «نوعِ نسخه + UUID»، پس اسکرپِ دوباره همان فایل را می‌بیند و چیزی اضافه
// نمی‌شود. اگر الگو نخورد (CDN دیگر، یا شکلِ تازه) به همان هشِ آدرس برمی‌گردیم — یعنی
// در بدترین حالت رفتار همان قبلی است، نه بدتر.
const CDN_RE = /\/([A-Za-z0-9_]+)\/[A-Za-z0-9_-]{8,}\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpe?g|png|webp|gif)(?:\?|$)/i
const extOf = (s: string) => s.toLowerCase().replace('jpeg', 'jpg')
const urlHashName = (url: string) => {
  const h = createHash('sha1').update(url).digest('hex').slice(0, 20)
  const e = /\.(jpe?g|png|webp|gif)(\?|$)/i.exec(url)
  return `${h}.${extOf(e?.[1] || 'webp')}`
}

export function localName(url: string): string {
  const m = CDN_RE.exec(url)
  if (!m) return urlHashName(url)
  return `${createHash('sha1').update(m[1] + ':' + m[2]).digest('hex').slice(0, 20)}.${extOf(m[3])}`
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
  // فایل‌هایی که با کلیدِ قدیمی ذخیره شده‌اند همچنان معتبرند و همان‌ها سِرو می‌شوند.
  // بدونِ این خط، تغییرِ کلید یعنی ۳۶ هزار دانلودِ تازه از دیوار و خوردن به سقفِ
  // ضدِاسکرپ. این‌طور گذار تدریجی و رایگان است: هر عکس فقط وقتی با کلیدِ تازه نوشته
  // می‌شود که آگهی‌اش دوباره اسکرپ شود.
  const legacy = urlHashName(url)
  if (legacy !== name) { try { if (existsSync(join(DIR, legacy))) return '/api/li/' + legacy } catch {} }
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
