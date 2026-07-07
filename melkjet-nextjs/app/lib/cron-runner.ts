import { listDueSources, getDivar } from './advisor-divar-store'
import { startBackgroundSync, driveJob } from './advisor-divar-import'
import { listPausedJobs, listQueuedJobs, countActiveJobs } from './advisor-divar-job'
import { publishDueArticles } from './scraper-store'
import { processTrackerQueue } from './tracker-sender'
import { processSavedSearches } from './alerts-runner'
import { processProfileGate } from './profile-gate-runner'
import { processWorkflows } from './workflow-runner'
import { maybeRunReveal, maybeCreateAccounts } from './persiansaze-cron'
import { maybeAutoScrape } from './hypersaz-scraper'
import { maybeAutoSyncCost } from './cost-store'
import { flushQueue } from './reos/queue'
import { trainEngageModel } from './reos/train'
import { syncGraphFromEvents } from './reos/graph'

// زمان‌بندِ سبک و بدونِ وابستگی برای سینکِ خودکارِ دیوار. روی سرورِ همیشه‌روشنِ
// pm2 با یک setInterval اجرا می‌شود؛ یک قفلِ global از اجرای موازی/تکراری جلوگیری می‌کند.
const TICK_MS = 5 * 60 * 1000 // هر ۵ دقیقه بررسی می‌شود کدام مشاور زمانش رسیده

declare global {
  // eslint-disable-next-line no-var
  var __mjCron: { started: boolean; running: boolean } | undefined
}

let lastDedupAt = 0   // آخرین باری که پاک‌سازیِ تکراری‌ها اجرا شد (throttle برای O(n²))
let lastSitemapAt = 0 // آخرین بررسیِ شاردهای سایت‌مپ (هشدارِ سوپرادمین برای شاردِ جدید)
let lastReosTrainAt = 0 // آخرین آموزشِ مدلِ REOS (هر ۶ ساعت)
async function tick(): Promise<{ due: number; synced: number }> {
  const g = globalThis.__mjCron
  if (!g || g.running) return { due: 0, synced: 0 }
  g.running = true
  let synced = 0
  let due: { phone: string; source: any }[] = []
  try {
    try { await publishDueArticles() } catch { /* مقالاتِ زمان‌بندی‌شده */ }
    try { await processTrackerQueue(Date.now()) } catch { /* صفِ پیامکِ هدفمندِ ترکر */ }
    try { await processSavedSearches(Date.now()) } catch { /* هشدارِ آگهیِ جدید */ }
    try { await processProfileGate(Date.now()) } catch { /* سامانهٔ تکمیلِ پروفایل */ }
    try { await processWorkflows(Date.now()) } catch { /* موتورِ اتوماسیونِ گردش‌کار */ }
    try { maybeRunReveal(Date.now()) } catch { /* گرفتنِ هفتگیِ شمارهٔ سازنده‌های پرشین سازه */ }
    try { maybeCreateAccounts() } catch { /* ساختِ خودکارِ حسابِ سازنده پس از به‌روزشدنِ پروفایل‌ها */ }
    try { maybeAutoScrape(Date.now()) } catch { /* اسکرپِ خودکارِ زمان‌بندی‌شدهٔ کاتالوگ */ }
    maybeAutoSyncCost(Date.now()).catch(() => { /* سینکِ هفتگیِ قیمتِ مدل‌های AI از API */ })
    // REOS: تنظیماتِ سوپرادمین را بارگذاری کن + صفِ رویداد را فلاش کن + آموزشِ دوره‌ای طبقِ تنظیمات.
    let reosCfg = { training: { autoHours: 6, enabled: true } }
    try { const { primeConfig } = await import('./reos/reos-config'); reosCfg = await primeConfig() } catch { /* تنظیماتِ REOS */ }
    try { await flushQueue() } catch { /* صفِ رویدادِ REOS */ }
    if (reosCfg.training.enabled && Date.now() - lastReosTrainAt > Math.max(1, reosCfg.training.autoHours) * 60 * 60 * 1000) {
      lastReosTrainAt = Date.now()
      try { const w = await trainEngageModel(); console.log(`[reos] engage model: n=${w.n} auc=${w.auc} default=${w.usedDefault}`) } catch { /* آموزشِ REOS */ }
      try { const { trainLeadModel, primeLeadModel } = await import('./reos/lead-model'); const lw = await trainLeadModel(); await primeLeadModel(); console.log(`[reos] lead model: n=${lw.n} auc=${lw.auc} default=${lw.usedDefault}`) } catch { /* آموزشِ مدلِ لید */ }
      try { const g = await syncGraphFromEvents(5000); console.log(`[reos] knowledge graph: +${g.nodes} nodes, +${g.edges} edges`) } catch { /* گرافِ دانشِ REOS */ }
      try { const { computeMarketFeatures } = await import('./reos/market-features'); const areas = await computeMarketFeatures(); console.log(`[reos] market features: ${areas} areas`) } catch { /* ویژگی‌های بازارِ REOS */ }
      try { const { runIdleAutomations } = await import('./reos/crm'); const acted = await runIdleAutomations(); if (acted) console.log(`[reos] CRM idle automations: ${acted} actions`) } catch { /* اتوماسیونِ CRM OS */ }
      try { const { runAllIdleWorkflows } = await import('./reos/workflow-builder'); const w = await runAllIdleWorkflows(); if (w) console.log(`[reos] workflows: ${w} actions`) } catch { /* گردش‌کارِ REOS */ }
      try { const { computeMarketIntel } = await import('./reos/market-intel'); const mi = await computeMarketIntel(); console.log(`[reos] market intel: ${mi} areas`) } catch { /* هوشِ بازارِ REOS */ }
      try { const { runAutoML } = await import('./reos/automl'); const am = await runAutoML(); const promoted = am.filter(r => r.promoted).map(r => r.name); if (promoted.length) console.log(`[reos] AutoML promoted: ${promoted.join(', ')}`) } catch { /* AutoMLِ REOS */ }
      try { const { syncMarketGraph } = await import('./reos/market-graph'); const mg = await syncMarketGraph(); console.log(`[reos] market graph: ${mg.areas} areas, ${mg.edges} edges`) } catch { /* گرافِ بازارِ REOS */ }
      try { const { syncTerritories } = await import('./reos/territory-sync'); const t = await syncTerritories(); console.log(`[reos] market dominance: ${t.records} records, ${t.territories} territories, ${t.agents} agents`) } catch { /* اقتدارِ بازارِ REOS */ }
      try { const { resolveDueBattles } = await import('./reos/territory'); const b = await resolveDueBattles(); if (b) console.log(`[reos] territory battles resolved: ${b}`) } catch { /* نبردهای قلمروِ REOS */ }
    }
    due = listDueSources(Date.now())
    for (const { phone, source } of due) {
      try {
        const base = getDivar(phone)
        // اسکرپِ پس‌زمینهٔ ازسرگیری‌پذیر (fire-and-forget؛ کرون را قفل نمی‌کند).
        const r = startBackgroundSync(phone, { ...base, searchUrl: source.searchUrl, divarName: source.divarName, autoPublish: source.autoPublish, autoNeighborhood: source.autoNeighborhood, schedule: source.schedule }, source.id, source.name || 'همگام‌سازیِ منبع')
        if (r.started) synced++
      } catch { /* خطای یک منبع بقیه را متوقف نکند */ }
    }
    // (درین‌کردنِ صفِ اسکرپ و ممیزیِ دسته‌ای در queueTick هر ۴۵ ثانیه انجام می‌شود.)
    // اگر آگهیِ جدیدی ایمپورت شد، تکراری‌ها را پاک کن (SEO) — حداکثر هر ۳۰ دقیقه (O(n²) است).
    if (synced && Date.now() - lastDedupAt > 30 * 60 * 1000) {
      lastDedupAt = Date.now()
      try { const { dedupeListings } = await import('./listing-dedupe'); dedupeListings() } catch {}
    }
    // سایت‌مپ هر ۱ ساعت: اول slugها را پیش‌محاسبه کن (یک نوشتِ واحد، خارج از مسیرِ درخواست
    // تا سایت‌مپ فقط‌خواندنی و سریع بماند و ۵۰۴ ندهد)، بعد شاردِ جدید را چک/هشدار بده.
    if (Date.now() - lastSitemapAt > 60 * 60 * 1000) {
      lastSitemapAt = Date.now()
      try { const { precomputeSlugs, checkNewShards, precomputeSitemapXml } = await import('./sitemap-store'); await precomputeSlugs(); await checkNewShards(); await precomputeSitemapXml() } catch {}
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
  const paths = ['/', '/search', '/builders']
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
  // کارگرِ صف: هر ۴۵ ثانیه صفِ اسکرپ را با سقفِ همزمانی درین می‌کند + ممیزیِ دسته‌ای.
  setTimeout(() => { queueTick().catch(() => {}) }, 20_000)     // زودتر از tick تا سینکِ کاربر سریع شروع شود
  setInterval(() => { queueTick().catch(() => {}) }, QUEUE_TICK_MS)
  // بدونِ حلقهٔ گرم‌کردنِ مکرر — منبعِ اصلیِ مصرفِ بی‌مورد CPU بود.
}

// ── کارگرِ صفِ اسکرپ (فقط اینستنسِ ۰) ────────────────────────────────────────
// اصلِ معماری برای مقیاس: اینستنس‌های کاربری فقط «در صف می‌گذارند»؛ کارِ سنگین اینجا،
// روی اینستنسِ ۰، با سقفِ همزمانیِ سراسری اجرا می‌شود. پس هزار مشاورِ همزمان =
// یک صفِ منظم، نه هزار حلقهٔ موازی روی اینستنس‌های کاربری.
const MAX_ACTIVE_SYNCS = 2          // حداکثر همگام‌سازیِ همزمان روی کلِ سیستم
const QUEUE_TICK_MS = 45 * 1000     // هر ۴۵ ثانیه صف را درین کن (پاسخ‌گوییِ خوب به کاربر)
let queueRunning = false
let moderating = false

async function queueTick(): Promise<void> {
  if (queueRunning) return
  queueRunning = true
  try {
    // ۱) درین‌کردنِ صف با سقفِ همزمانی: اول هولدشده‌ها (ادامه)، بعد صفِ جدید.
    let active = countActiveJobs()
    if (active < MAX_ACTIVE_SYNCS) {
      const queue = [...listPausedJobs(), ...listQueuedJobs()]
      for (const phone of queue) {
        if (active >= MAX_ACTIVE_SYNCS) break
        active++
        driveJob(phone).catch(() => {})   // fire-and-forget؛ هر کار بودجهٔ ۳.۵دقیقهٔ خودش را دارد
      }
    }
    // ۲) ممیزیِ دسته‌ایِ آگهی‌های منتشرشدهٔ منتظر (به‌جای فراخوانِ AI برای هر آگهی هنگامِ ایمپورت).
    //    اگر چیزی منتظر نباشد، سریع و بی‌هزینه برمی‌گردد. قفلِ moderating از هم‌پوشانی جلوگیری می‌کند.
    if (!moderating) {
      moderating = true
      try { const { moderatePending } = await import('./moderation'); await moderatePending() }
      catch { /* اگر AI/مدل آماده نبود */ } finally { moderating = false }
    }
  } finally { queueRunning = false }
}

// اجرای فوریِ یک چرخه (برای تریگرِ دستی/خارجی).
export async function runCronNow() { return tick() }
