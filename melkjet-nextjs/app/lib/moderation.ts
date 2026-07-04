import { pendingForModeration, setModeration, setModerationBatch, Item, ItemStatus } from './scraper-store'
import { chatCompleteSafe, agentModel } from './gapgpt'
import { predict, learn, noteDecision } from './moderation-ml'
import { getAdminData } from './admin-store'

export type ModVia = 'ml' | 'ai' | 'none'

// معیارهای پیش‌فرض (اگر ادمین چیزی تعریف نکرده باشد).
export const DEFAULT_CRITERIA = `- آگهیِ معتبر: عنوانِ روشن، قیمتِ مشخص و واقعی، موقعیت و توضیحاتِ کافی → امتیازِ بالا.
- رد: آگهیِ تکراری، اسپم/تبلیغ، قیمتِ به‌وضوح غیرواقعی، اطلاعاتِ خیلی ناقص، محتوای نامرتبط → امتیازِ پایین.
- امتیاز (۰ تا ۱۰۰): هرچه آگهی کامل‌تر، معتبرتر و باکیفیت‌تر باشد، امتیازِ بالاتر بده.`

export interface ModConfig { criteria: string; approveMin: number; rejectMax: number; requirePrice: boolean; priceMissing: 'reject' | 'review'; autoMl: boolean }

// خواندنِ معیارها از تنظیماتِ ادمین (با پیش‌فرض‌های امن).
export function modConfig(): ModConfig {
  const m = getAdminData().moderation || {}
  return {
    criteria: (m.criteria && m.criteria.trim()) ? m.criteria : DEFAULT_CRITERIA,
    approveMin: typeof m.approveMin === 'number' ? m.approveMin : 70,
    rejectMax: typeof m.rejectMax === 'number' ? m.rejectMax : 40,
    requirePrice: !!m.requirePrice,
    priceMissing: m.priceMissing === 'review' ? 'review' : 'reject',
    autoMl: m.autoMl !== false,
  }
}

function buildSys(criteria: string): string {
  return `تو ناظر آگهی‌های املاک در ملک‌جت هستی. بر اساسِ «معیارها» هر آگهی را بررسی کن و فقط یک JSON معتبر برگردان:
{"verdict":"approve|reject|review","score":0-100,"reason":"علت کوتاه فارسی (یک جمله)"}
معیارها:
${criteria}
همیشه reason را پر کن و امتیاز را دقیق و منصفانه بده.`
}

// تبدیلِ پاسخِ مدل به تصمیم — تصمیم بر اساسِ «آستانه‌های امتیازِ» قابلِ‌تنظیمِ ادمین گرفته می‌شود.
function judge(text: string, cfg: ModConfig, hasPrice: boolean): { status: ItemStatus; reason: string; score: number } {
  let t = text
  const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0]
  try {
    const d = JSON.parse(t)
    const score = Math.max(0, Math.min(100, Number(d.score) || 0))
    const reason = String(d.reason || '').slice(0, 200)
    // قانونِ سختِ «قیمت الزامی است»
    if (cfg.requirePrice && !hasPrice) {
      return { status: cfg.priceMissing === 'review' ? 'pending' : 'rejected', reason: reason || 'قیمت مشخص نیست', score }
    }
    // آستانه: امتیاز ≥ approveMin → تأیید، ≤ rejectMax → رد، بین این‌دو → بازبینیِ دستی
    const status: ItemStatus = score >= cfg.approveMin ? 'approved' : score <= cfg.rejectMax ? 'rejected' : 'pending'
    return { status, reason, score }
  } catch { return { status: 'pending', reason: 'پاسخ نامعتبر مدل', score: 0 } }
}

export function moderationModel(): string | null {
  return agentModel('moderation', 'text') || agentModel('chat', 'text') || agentModel('pricing', 'text') || null
}

// AI verdict for one item (read-only — does NOT persist).
async function getVerdict(it: Item, model: string, cfg: ModConfig) {
  const info = `عنوان: ${it.title}\nقیمت: ${it.price || '-'}\nموقعیت: ${it.location || '-'}\nتوضیحات: ${(it.excerpt || '').slice(0, 600)}`
  try {
    const out = await chatCompleteSafe(model, [{ role: 'system', content: buildSys(cfg.criteria) }, { role: 'user', content: info }], { temperature: 0.2, max_tokens: 120 })
    return { id: it.id, title: it.title, ...judge(out, cfg, !!(it.price && String(it.price).trim())) }
  } catch (e: any) {
    return { id: it.id, title: it.title, status: 'pending' as ItemStatus, reason: e?.message || 'خطا', score: 0 }
  }
}

// تصمیمِ هوشمند برای یک آگهی: اول مدلِ یادگیرنده؛ اگر آماده و مطمئن بود خودش تصمیم می‌گیرد
// (بدونِ AI). وگرنه AI تصمیم می‌گیرد و مدل از تصمیمش یاد می‌گیرد. (persist نمی‌کند.)
async function smartVerdict(it: Item, model: string | null): Promise<{ id: string; title: string; status: ItemStatus; reason: string; score: number; via: ModVia }> {
  const cfg = modConfig()
  const p = predict(it)
  if (p.confident && cfg.autoMl) {
    noteDecision('ml')
    return { id: it.id, title: it.title, status: p.label, score: Math.round(p.prob * 100), via: 'ml', reason: `ممیزیِ خودکارِ یادگیری‌شده (اطمینان ${Math.round(p.prob * 100)}٪)` }
  }
  if (!model) return { id: it.id, title: it.title, status: 'pending', reason: 'در انتظارِ ممیزی (مدل تنظیم نشده و دادهٔ یادگیری کافی نیست)', score: 0, via: 'none' }
  const v = await getVerdict(it, model, cfg)
  if (v.status === 'approved' || v.status === 'rejected') { try { learn(it, v.status, 'ai'); noteDecision('ai') } catch {} }
  return { ...v, via: 'ai' }
}

// Moderate a single item now (persists immediately). Used for one-off (user submit / single id).
export async function moderateOne(it: Item, model: string | null) {
  const v = await smartVerdict(it, model)
  await setModeration(it.id, v.status, v.reason, v.score)
  return v
}

// ممیزیِ «قبل از انتشار» روی فیلدهای خام (بدونِ آیتمِ ذخیره‌شده) — برای آگهیِ مشاور/آژانس.
export async function moderateFields(fields: { title: string; price?: string; location?: string; excerpt?: string; meta?: Record<string, string> }): Promise<{ status: ItemStatus; reason: string; score: number; via: ModVia }> {
  const pseudo = { id: '__prepublish__', title: fields.title, price: fields.price, location: fields.location, excerpt: fields.excerpt, meta: fields.meta } as Item
  const v = await smartVerdict(pseudo, moderationModel())
  return { status: v.status, reason: v.reason, score: v.score, via: v.via }
}

// آموزشِ مدل از تصمیمِ دستیِ ادمین (تأیید/رد) — قوی‌ترین سیگنالِ یادگیری.
export function teachFromAdmin(it: Item, status: ItemStatus) {
  if (status === 'approved' || status === 'rejected') { try { learn(it, status, 'admin') } catch {} }
}

// Run AI calls with limited concurrency (verdicts are read-only; one atomic write at the end).
async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]) }
  })
  await Promise.all(workers)
  return out
}

// Moderate all pending items quickly (concurrent verdicts, batched write). Returns total + results.
// مدلِ یادگیرنده اول تلاش می‌کند؛ اگر آماده نبود از AI کمک می‌گیرد و یاد می‌گیرد.
export async function moderatePending(max = 300): Promise<{ moderated: number; results: any[]; error?: string }> {
  const model = moderationModel()   // ممکن است null باشد — مدلِ یادگیرنده می‌تواند بدونِ AI تصمیم بگیرد

  const queue = await pendingForModeration(max)
  if (!queue.length) return { moderated: 0, results: [] }

  const results = await pool(queue, 5, (it) => smartVerdict(it, model))
  // فقط مواردی که واقعاً تصمیم‌گیری شده‌اند را بنویس (pending را دست‌نخورده بگذار).
  const decided = results.filter(r => r.status === 'approved' || r.status === 'rejected')
  await setModerationBatch(decided.map(r => ({ id: r.id, status: r.status, reason: r.reason, score: r.score })))
  const err = (!model && decided.length === 0) ? 'مدلِ AI تنظیم نشده و دادهٔ یادگیری هنوز کافی نیست' : undefined
  return { moderated: decided.length, results, error: err }
}

// ── ممیزیِ هوش مصنوعیِ نظراتِ مشتریان ───────────────────────────────────────────
const REVIEW_SYS = `تو ناظرِ نظراتِ کاربران در یک سایتِ املاک هستی. نظرِ ثبت‌شده را بررسی کن و فقط یک JSON معتبر برگردان:
{"verdict":"approve|reject","reason":"علتِ کوتاهِ فارسی (یک جمله)"}
approve = نظرِ واقعی، محترمانه و مرتبط با کسب‌وکار/خدمات.
reject = توهین/فحاشی، تبلیغ یا اسپم، شمارهٔ تماس یا لینک، محتوای نامرتبط، یا متنِ بی‌معنی/تکراری.
همیشه reason را پر کن.`

// نتیجهٔ ممیزیِ یک نظر. اگر مدلی تنظیم نشده باشد → 'review' (در انتظارِ تأییدِ دستی).
export async function moderateReview(name: string, text: string): Promise<{ verdict: 'approve' | 'reject' | 'review'; reason: string }> {
  const model = moderationModel()
  if (!model) return { verdict: 'review', reason: 'هوش مصنوعی تنظیم نشده؛ در انتظارِ بررسی' }
  try {
    const out = await chatCompleteSafe(model, [
      { role: 'system', content: REVIEW_SYS },
      { role: 'user', content: `نام: ${String(name || '').slice(0, 60)}\nمتنِ نظر: ${String(text || '').slice(0, 600)}` },
    ], { temperature: 0.1, max_tokens: 90 })
    let t = out; const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0]
    const d = JSON.parse(t)
    const v = d.verdict === 'approve' ? 'approve' : d.verdict === 'reject' ? 'reject' : 'review'
    return { verdict: v, reason: String(d.reason || '').slice(0, 200) }
  } catch (e: any) {
    return { verdict: 'review', reason: e?.message || 'خطای ممیزی؛ در انتظارِ بررسی' }
  }
}
