import { getAdminData } from './admin-store'

// ── استخرِ چرخشیِ پروکسیِ دیوار (فاز ۲۶۰) ────────────────────────────────────
// throttleِ دیوار **per-IP** است: چند درخواستِ هم‌زمان از یک IP → پاسخِ ۳۰–۵۰ثانیه‌ای
// (fetchِ تکی <۱ث است). این استخر بارِ درخواست‌های هم‌زمان را با round-robin بینِ چند
// پروکسیِ با IPِ جدا پخش می‌کند، پس هر IP زیرِ سقفِ تحملِ دیوار می‌ماند و throttle نمی‌خورَد.
// پروکسی‌ای که خطا/۴۲۹/تایم‌اوت داد موقتاً «خنک» می‌شود و از چرخش کنار می‌رود تا حالش جا بیاید.
//
// ── پیکربندی ──
// استخر از یک منبعِ «جدا» می‌خواند تا فیلدِ تکیِ `divar.proxyUrl` (که ده‌ها جای دیگر —
// تلگرام/web-push/search-console/… — به‌عنوانِ یک URLِ تکی می‌خوانند) دست‌نخورده بماند.
// اولویت:
//   ۱) env `DIVAR_PROXIES`  (چند IP جداشده با کاما/خط؛ راهِ اصلی — در .env.production.local + reload)
//   ۲) فیلدِ اختیاریِ ادمین `divar.proxyPool` (اگر روزی در UI اضافه شد)
//   ۳) fallback: همان `divar.proxyUrl`ِ تکیِ فعلی → رفتارِ دقیقاً قبلی، بدونِ هیچ تغییر.
// خالیِ همه = مستقیم/env. IPها باید «ایرانی» باشند (دیوار IPِ خارجی را فیلتر می‌کند).
// مثال (.env.production.local):
//   DIVAR_PROXIES=http://127.0.0.1:1080,http://user:pass@94.x.x.x:8080,http://95.x.x.x:3128

function rawProxyConfig(): string {
  const d = getAdminData().divar as (Record<string, unknown> | undefined)
  return String(
    process.env.DIVAR_PROXIES
    || (d?.proxyPool as string | undefined)
    || d?.proxyUrl
    || process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || '',
  )
}

/** فهرستِ پروکسی‌های معتبرِ پیکربندی‌شده (بدونِ تکرار). */
export function divarProxies(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of rawProxyConfig().split(/[\n,]+/).map(s => s.trim()).filter(Boolean)) {
    try { new URL(p); if (!seen.has(p)) { seen.add(p); out.push(p) } } catch { /* آدرسِ نامعتبر رد می‌شود */ }
  }
  return out
}

// سلامتِ هر پروکسی — module-level (per-process؛ کارِ اسکرپ فقط روی instance 0 است).
const health = new Map<string, { cooldownUntil: number; fails: number }>()
let rr = 0

/** یک پروکسیِ سالم برمی‌گرداند (round-robin؛ پروکسیِ خنک‌شده رد می‌شود).
 *  - صفر پروکسی → `undefined` (مستقیم/env، رفتارِ قبلی).
 *  - یک پروکسی → همان (رفتارِ قبلی، بدونِ تغییر).
 *  - چند پروکسی → چرخشِ منصفانه بینِ سالم‌ها؛ اگر همه خنک بودند، بازهم می‌چرخد (بهتر از هیچ). */
export function pickDivarProxy(): string | undefined {
  const proxies = divarProxies()
  if (proxies.length <= 1) return proxies[0]
  const now = Date.now()
  const healthy = proxies.filter(p => (health.get(p)?.cooldownUntil || 0) <= now)
  const pool = healthy.length ? healthy : proxies
  const pick = pool[rr % pool.length]
  rr = (rr + 1) % 1_000_000
  return pick
}

/** نتیجهٔ یک درخواست را ثبت می‌کند: موفق → ریست؛ خطا/۴۲۹/تایم‌اوت → خنک‌سازیِ نمایی (۵ث تا ۵دقیقه). */
export function reportDivarProxy(url: string | undefined, ok: boolean): void {
  if (!url || divarProxies().length <= 1) return   // با تک‌پروکسی خنک‌سازی بی‌معناست (جایگزینی نیست)
  const h = health.get(url) || { cooldownUntil: 0, fails: 0 }
  if (ok) { h.fails = 0; h.cooldownUntil = 0 }
  else {
    h.fails = Math.min(h.fails + 1, 6)
    const backoff = [5, 15, 30, 60, 120, 300][h.fails - 1] * 1000
    h.cooldownUntil = Date.now() + backoff
  }
  health.set(url, h)
}

/** وضعیتِ استخر برای پایش (پنلِ سلامت یا لاگ). */
export function divarProxyStatus(): { count: number; proxies: { url: string; healthy: boolean; fails: number; cooldownSec: number }[] } {
  const now = Date.now()
  const proxies = divarProxies().map(p => {
    const h = health.get(p)
    return { url: p, healthy: !h || h.cooldownUntil <= now, fails: h?.fails || 0, cooldownSec: Math.max(0, Math.round(((h?.cooldownUntil || 0) - now) / 1000)) }
  })
  return { count: proxies.length, proxies }
}
