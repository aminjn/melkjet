import { pendingForModeration, setModeration, setModerationBatch, Item, ItemStatus } from './scraper-store'
import { chatCompleteSafe, agentModel } from './gapgpt'

const SYS = `تو ناظر آگهی‌های املاک در ملک‌جت هستی. هر آگهی را بررسی کن و فقط یک JSON معتبر برگردان:
{"verdict":"approve|reject|review","score":0-100,"reason":"علت کوتاه فارسی (یک جمله)"}
approve = آگهی معتبر و کامل. reject = مشکوک/ناقص/تکراری/قیمت غیرواقعی. review = نیاز به بررسی دستی.
همیشه reason را پر کن.`

export function moderationModel(): string | null {
  return agentModel('moderation', 'text') || agentModel('chat', 'text') || agentModel('pricing', 'text') || null
}

function judge(text: string): { status: ItemStatus; reason: string; score: number } {
  let t = text
  const m = t.match(/\{[\s\S]*\}/); if (m) t = m[0]
  try {
    const d = JSON.parse(t)
    const v = d.verdict
    const status: ItemStatus = v === 'approve' ? 'approved' : v === 'reject' ? 'rejected' : 'pending'
    return { status, reason: String(d.reason || '').slice(0, 200), score: Math.max(0, Math.min(100, Number(d.score) || 0)) }
  } catch { return { status: 'pending', reason: 'پاسخ نامعتبر مدل', score: 0 } }
}

// AI verdict for one item (read-only — does NOT persist).
async function getVerdict(it: Item, model: string) {
  const info = `عنوان: ${it.title}\nقیمت: ${it.price || '-'}\nموقعیت: ${it.location || '-'}\nتوضیحات: ${(it.excerpt || '').slice(0, 600)}`
  try {
    const out = await chatCompleteSafe(model, [{ role: 'system', content: SYS }, { role: 'user', content: info }], { temperature: 0.2, max_tokens: 120 })
    return { id: it.id, title: it.title, ...judge(out) }
  } catch (e: any) {
    return { id: it.id, title: it.title, status: 'pending' as ItemStatus, reason: e?.message || 'خطا', score: 0 }
  }
}

// Moderate a single item now (persists immediately). Used for one-off (user submit / single id).
export async function moderateOne(it: Item, model: string) {
  const v = await getVerdict(it, model)
  setModeration(it.id, v.status, v.reason, v.score)
  return v
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
export async function moderatePending(max = 300): Promise<{ moderated: number; results: any[]; error?: string }> {
  const model = moderationModel()
  if (!model) return { moderated: 0, results: [], error: 'مدلی به ایجنت تأیید (ModerationAgent) داده نشده' }

  const queue = pendingForModeration(max)
  if (!queue.length) return { moderated: 0, results: [] }

  const results = await pool(queue, 5, (it) => getVerdict(it, model))
  setModerationBatch(results.map(r => ({ id: r.id, status: r.status, reason: r.reason, score: r.score })))
  return { moderated: results.length, results }
}
