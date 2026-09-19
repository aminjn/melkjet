// نوشتنِ اتمیِ فایل — جای‌گزینِ writeFileSync در سراسرِ app/lib.
//
// درسِ ۲۹ اوت ۲۰۲۶: writeFileSync اول فایل را خالی می‌کند و بعد می‌نویسد. وقتی
// دیسک پر شد، نوشتن شکست خورد و فایلِ ۲۹۲۹ حساب صفر ماند. rename در یک فایل‌سیستم
// تجزیه‌ناپذیر است — یا کامل انجام می‌شود یا اصلاً — پس دادهٔ قبلی هرگز نمی‌رود.
//
// این ماژول writeFileSync را می‌پوشاند و بقیهٔ fs را دست‌نخورده می‌رساند.
//
// ۱۹ سپتامبر — قبلاً `export * from 'fs'` بود. بایلد هشدار می‌داد: fs یک ماژولِ
// CommonJSِ خارجی است و صادراتش فقط در زمانِ اجرا معلوم می‌شود، پس Turbopack برای هر
// مصرف‌کننده کدِ interopِ اضافه تولید می‌کرد. نام‌هایی که واقعاً استفاده می‌شوند صریح شدند.
// اگر به تابعِ دیگری از fs نیاز داری، همین‌جا به فهرست اضافه‌اش کن (یا مستقیم از 'fs' بگیر).
// صادراتِ پیش‌فرض (fs) همچنان کلِ nodeFs را دارد — ۱۱ فایلی که `import fs from './fs-atomic'`
// می‌کنند دست‌نخورده‌اند، چون آن یک آبجکتِ زمانِ اجراست نه `export *`.
import * as nodeFs from 'fs'
export { existsSync, mkdirSync, readFileSync } from 'fs'

export function writeFileSync(file: unknown, data: unknown, options?: unknown): void {
  // توصیف‌گرِ فایل یا URL را دست نمی‌زنیم؛ فقط مسیرِ رشته‌ای اتمی می‌شود.
  if (typeof file !== 'string') return nodeFs.writeFileSync(file as never, data as never, options as never)
  const tmp = `${file}.tmp.${process.pid}.${Math.random().toString(36).slice(2, 8)}`
  let fd: number | null = null
  try {
    fd = nodeFs.openSync(tmp, 'w')
    nodeFs.writeFileSync(fd, data as never, options as never)
    nodeFs.fsyncSync(fd)
    nodeFs.closeSync(fd); fd = null
    nodeFs.renameSync(tmp, file)
  } catch (e) {
    if (fd !== null) { try { nodeFs.closeSync(fd) } catch {} }
    try { nodeFs.unlinkSync(tmp) } catch {}
    throw e
  }
}

const fs = { ...nodeFs, writeFileSync }
export default fs
