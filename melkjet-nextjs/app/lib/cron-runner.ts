import { listDueSources, getDivar, markSourceRun } from './advisor-divar-store'
import { syncAdvisorDivar } from './advisor-divar-import'
import { publishDueArticles } from './scraper-store'
import { processTrackerQueue } from './tracker-sender'
import { processSavedSearches } from './alerts-runner'
import { processProfileGate } from './profile-gate-runner'
import { processWorkflows } from './workflow-runner'
import { maybeRunReveal, maybeCreateAccounts } from './persiansaze-cron'
import { maybeAutoScrape } from './hypersaz-scraper'

// زمان‌بندِ سبک و بدونِ وابستگی برای سینکِ خودکارِ دیوار. روی سرورِ همیشه‌روشنِ
// pm2 با یک setInterval اجرا می‌شود؛ یک قفلِ global از اجرای موازی/تکراری جلوگیری می‌کند.
const TICK_MS = 5 * 60 * 1000 // هر ۵ دقیقه بررسی می‌شود کدام مشاور زمانش رسیده

declare global {
  // eslint-disable-next-line no-var
  var __mjCron: { started: boolean; running: boolean } | undefined
}

async function tick(): Promise<{ due: number; synced: number }> {
  const g = globalThis.__mjCron
  if (!g || g.running) return { due: 0, synced: 0 }
  g.running = true
  let synced = 0
  let due: { phone: string; source: any }[] = []
  try {
    try { publishDueArticles() } catch { /* مقالاتِ زمان‌بندی‌شده */ }
    try { await processTrackerQueue(Date.now()) } catch { /* صفِ پیامکِ هدفمندِ ترکر */ }
    try { await processSavedSearches(Date.now()) } catch { /* هشدارِ آگهیِ جدید */ }
    try { await processProfileGate(Date.now()) } catch { /* سامانهٔ تکمیلِ پروفایل */ }
    try { await processWorkflows(Date.now()) } catch { /* موتورِ اتوماسیونِ گردش‌کار */ }
    try { maybeRunReveal(Date.now()) } catch { /* گرفتنِ هفتگیِ شمارهٔ سازنده‌های پرشین سازه */ }
    try { maybeCreateAccounts() } catch { /* ساختِ خودکارِ حسابِ سازنده پس از به‌روزشدنِ پروفایل‌ها */ }
    try { maybeAutoScrape(Date.now()) } catch { /* اسکرپِ خودکارِ زمان‌بندی‌شدهٔ کاتالوگ */ }
    due = listDueSources(Date.now())
    for (const { phone, source } of due) {
      try {
        const base = getDivar(phone)
        const r = await syncAdvisorDivar(phone, { ...base, searchUrl: source.searchUrl, divarName: source.divarName, autoPublish: source.autoPublish, autoNeighborhood: source.autoNeighborhood, schedule: source.schedule }, source.id)
        markSourceRun(phone, source.id, r.imported || 0, r.ok ? '' : (r.reason || 'خطا'))
        synced++
      } catch { /* خطای یک منبع بقیه را متوقف نکند */ }
    }
  } finally { g.running = false }
  return { due: due.length, synced }
}

// گرم‌کردنِ همهٔ instanceها بعد از بوت/ری‌استارت. هر اینستنس روی پورتِ جدا اجرا می‌شود
// (۳۰۰۰..۳۰۰۳ پشتِ nginx) و کشِ سنگینِ خودش را دارد (پرشین‌سازه/بازار/محله). پس باید
// «همهٔ پورت‌ها» را مستقیم ping کنیم تا هیچ اینستنسی سرد نماند و کاربر به اینستنسِ سرد نخورد.
// لیستِ پورت‌ها از WARM_PORTS (در ecosystem.config.js) خوانده می‌شود؛ اگر نبود فقط پورتِ خودش.
// گرم‌کردنِ سبک — فقط چند صفحهٔ اصلی، یک‌بار پس از بوت. (APIهای سنگین را گرم نمی‌کنیم؛
// آن‌ها با اولین ترافیکِ واقعی کش می‌شوند. گرم‌کردنِ مکررِ APIهای ۱۹هزار-پروژه‌ای CPU را می‌سوزاند.)
async function warmUp() {
  const ports = (process.env.WARM_PORTS || String(process.env.PORT || 3000)).split(',').map(s => s.trim()).filter(Boolean)
  const paths = ['/', '/search', '/sazandeha']
  for (const port of ports) {
    for (const p of paths) { try { await fetch(`http://127.0.0.1:${port}${p}`, { cache: 'no-store' }) } catch {} }
  }
}

export function ensureCronStarted() {
  // در cluster mode فقط instance صفر کرون را اجرا کند (وگرنه چند Chrome/کرون موازی راه می‌افتد).
  const inst = process.env.NODE_APP_INSTANCE
  if (inst !== undefined && inst !== '0') return
  if (typeof globalThis.__mjCron === 'undefined') globalThis.__mjCron = { started: false, running: false }
  const g = globalThis.__mjCron!
  if (g.started) return
  g.started = true
  setTimeout(() => { warmUp().catch(() => {}) }, 8_000)         // یک‌بار گرم‌کردنِ سبک پس از بوت
  setTimeout(() => { tick().catch(() => {}) }, 30_000)          // کمی بعد از بوت
  setInterval(() => { tick().catch(() => {}) }, TICK_MS)
  // بدونِ حلقهٔ گرم‌کردنِ مکرر — منبعِ اصلیِ مصرفِ بی‌مورد CPU بود.
}

// اجرای فوریِ یک چرخه (برای تریگرِ دستی/خارجی).
export async function runCronNow() { return tick() }
