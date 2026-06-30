import { listDueSources, getDivar, markSourceRun } from './advisor-divar-store'
import { syncAdvisorDivar } from './advisor-divar-import'
import { publishDueArticles } from './scraper-store'
import { processTrackerQueue } from './tracker-sender'
import { processSavedSearches } from './alerts-runner'
import { processProfileGate } from './profile-gate-runner'
import { processWorkflows } from './workflow-runner'
import { maybeRunReveal, maybeCreateAccounts } from './persiansaze-cron'

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

// گرم‌کردنِ همهٔ instanceهای cluster بعد از بوت/ری‌استارت (اولین رندرِ هر صفحه سنگین است؛
// با چند ping به localhost، load-balancer به‌نوبت همهٔ instanceها را گرم می‌کند تا
// هیچ کاربری به instanceِ سرد نخورد و صفحهٔ اصلی ۸-۱۰ ثانیه‌ای نشود).
async function warmUp(rounds = 4) {
  const port = process.env.PORT || 3000
  const paths = ['/', '/search', '/pricing', '/store', '/blog']
  for (let r = 0; r < rounds; r++) {
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
  setTimeout(() => { warmUp(6).catch(() => {}) }, 8_000)        // گرم‌کردنِ همهٔ instanceها پس از بوت
  setTimeout(() => { tick().catch(() => {}) }, 30_000)          // کمی بعد از بوت
  setInterval(() => { tick().catch(() => {}) }, TICK_MS)
  setInterval(() => { warmUp(1).catch(() => {}) }, 90_000)      // نگه‌داشتنِ گرمی (هر ۹۰ ثانیه)
}

// اجرای فوریِ یک چرخه (برای تریگرِ دستی/خارجی).
export async function runCronNow() { return tick() }
