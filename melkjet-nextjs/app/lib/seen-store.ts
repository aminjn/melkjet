// فاز ۲۵۵ — «آگهی‌های دیده‌شده» سمتِ کلاینت (localStorage). وقتی کاربر یک آگهی را باز می‌کند
// markSeen صدا می‌خورد؛ کارتِ همان آگهی هرجای سایت نشانِ «دیده‌اید» می‌گیرد. کاملاً محلی و بی‌سرور.
const KEY = 'mj_seen_v1'
const MAX = 3000   // سقفِ نگه‌داری؛ سرریز → قدیمی‌ترین‌ها حذف

function read(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { return {} }
}

export function isSeen(id: string | number): boolean {
  if (!id) return false
  return !!read()[String(id)]
}

export function markSeen(id: string | number): void {
  if (typeof window === 'undefined' || !id) return
  try {
    const m = read()
    if (m[String(id)]) return   // قبلاً ثبت شده
    m[String(id)] = Date.now()
    const keys = Object.keys(m)
    if (keys.length > MAX) keys.sort((a, b) => m[a] - m[b]).slice(0, keys.length - MAX).forEach(k => delete m[k])
    localStorage.setItem(KEY, JSON.stringify(m))
    window.dispatchEvent(new Event('mj-seen-change'))
  } catch { /* حافظه پر/غیرمجاز — بی‌خطر رد شو */ }
}
