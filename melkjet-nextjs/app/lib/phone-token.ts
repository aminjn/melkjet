import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// فاز ۲۹۸ز — «شماره واقعاً از دیدِ ربات‌ها پنهان» (خواستهٔ صریحِ مالک): تا امروز RevealPhone
// شمارهٔ خام را به‌عنوان prop می‌گرفت، پس عددِ کامل در HTML/payload بود و فقط «بصری» ماسک می‌شد —
// یک اسکرپر راحت از سورس برش می‌داشت. حالا در HTML فقط «توکنِ رمزنگاری‌شده» (AES-256-GCM با کلیدِ
// سرور) می‌نشیند؛ موقعِ کلیک، سرور بازش می‌کند و شماره را برمی‌گرداند. بدونِ کلیدِ سرور، توکن
// بی‌ارزش است. (اختیاری: ماسکِ ۴رقمِ اول برای UI که لو نیست — همهٔ موبایل‌ها با 09 شروع می‌شوند.)

const KEY = scryptSync(process.env.JWT_SECRET || 'melkjet-default-secret-change-in-prod', 'mj-phone-seal-v1', 32)

/** رمزنگاریِ شماره → توکنِ متنیِ امن برای گذاشتن در HTML. ورودیِ خالی → رشتهٔ خالی. */
export function sealPhone(phone: string): string {
  const clean = String(phone || '').trim()
  if (!clean) return ''
  try {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', KEY, iv)
    const enc = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    // iv(12) + tag(16) + ciphertext → base64url
    return Buffer.concat([iv, tag, enc]).toString('base64url')
  } catch { return '' }
}

/** بازگشاییِ توکن → شماره. توکنِ نامعتبر/دستکاری‌شده → null. */
export function openPhone(token: string): string | null {
  const t = String(token || '').trim()
  if (!t) return null
  try {
    const buf = Buffer.from(t, 'base64url')
    if (buf.length < 28) return null
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const enc = buf.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(enc), decipher.final()])
    return dec.toString('utf8')
  } catch { return null }
}

/** ماسکِ امن برای نمایش پیش از کلیک (۴رقمِ اول — هویتی نیست). */
export function phoneMask(phone: string): string {
  const d = String(phone || '').replace(/[^\d]/g, '')
  return d.slice(0, 4) || '۰۹••'
}
