// REOS v3 · AI Gateway — router + cache + cost tracker + fallback برای همهٔ فراخوان‌های LLM.
// همهٔ مصرف‌کننده‌ها (Agent و…) از این‌جا عبور می‌کنند: انتخابِ مدل، کشِ نتیجه، ثبتِ هزینه/تأخیر،
// و fallback در خطا. caller تزریق‌پذیر است تا بدونِ شبکه تست شود. Dual-mode PG/file برای usage log.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { pgEnabled, pgTx } from '../db'
import { resolveAgent } from '../gapgpt'

export type LlmTask = 'agent' | 'content' | 'cheap' | 'vision'
export interface LlmMsg { role: string; content: string }
export interface LlmResult { text: string; model: string; provider?: string; cached: boolean; tokens: number; ms: number; ok: boolean; fallback: boolean }
// callerِ واقعی: (model, messages, opts, provider) → {text, tokens}
export type LlmCaller = (model: string, messages: LlmMsg[], opts: { temperature?: number; max_tokens?: number }, provider?: string) => Promise<{ text: string; tokens: number }>

const FALLBACK_MODEL = 'gpt-4o-mini'
// نگاشتِ task → اولویتِ (agentId, slot) برای انتخابِ مدل از تنظیماتِ ادمین.
const TASK_PREFS: Record<LlmTask, [string, 'text' | 'image'][]> = {
  agent: [['AssistantAgent', 'text'], ['ContentAgent', 'text']],
  content: [['ContentAgent', 'text'], ['AssistantAgent', 'text']],
  cheap: [['CheapAgent', 'text'], ['ContentAgent', 'text']],
  vision: [['VisionAgent', 'image'], ['ContentAgent', 'image']],
}

// ── Model selector / router ──
export function selectModel(task: LlmTask): { model: string; provider?: string } {
  const r = resolveAgent(TASK_PREFS[task] || TASK_PREFS.agent)
  return { model: r.model || FALLBACK_MODEL, provider: r.provider }
}

// ── Cache (in-memory با TTL) ──
const cache = new Map<string, { text: string; tokens: number; at: number }>()
const DEFAULT_TTL = 10 * 60 * 1000
export function cacheKey(model: string, messages: LlmMsg[], temperature = 0): string {
  return createHash('sha256').update(model + '|' + temperature + '|' + JSON.stringify(messages)).digest('hex').slice(0, 32)
}
export function cacheGet(key: string, ttl = DEFAULT_TTL, now = Date.now()): { text: string; tokens: number } | null {
  const v = cache.get(key); if (!v) return null; if (now - v.at > ttl) { cache.delete(key); return null }; return { text: v.text, tokens: v.tokens }
}
export function cacheSet(key: string, text: string, tokens: number, now = Date.now()): void { cache.set(key, { text, tokens, at: now }); if (cache.size > 2000) cache.delete(cache.keys().next().value as string) }
export function cacheClear(): void { cache.clear() }

// ── Cost tracker (usage log، dual-mode) ──
// هزینهٔ تقریبیِ هر ۱۰۰۰ توکن (تومان) — برای آنالیتیکس؛ نرخ در admin قابلِ‌تنظیم است.
const RATE_PER_1K: Record<string, number> = { 'gpt-4o': 3000, 'gpt-4o-mini': 300, default: 800 }
export function estimateCost(model: string, tokens: number): number { const r = RATE_PER_1K[model] ?? RATE_PER_1K.default; return Math.round((tokens / 1000) * r) }

const USAGE_FILE = join(process.cwd(), '.reos-ai-usage.json')
interface Usage { id: string; at: number; task: string; model: string; provider?: string; tokens: number; ms: number; cached: boolean; ok: boolean }
let usageReady = false
async function ensureUsage() {
  if (usageReady) return
  await pgTx(c => c.query(`CREATE TABLE IF NOT EXISTS reos_ai_usage (
    id text PRIMARY KEY, at bigint NOT NULL, task text, model text, provider text, tokens bigint NOT NULL DEFAULT 0,
    ms integer NOT NULL DEFAULT 0, cached boolean NOT NULL DEFAULT false, ok boolean NOT NULL DEFAULT true )`))
  await pgTx(c => c.query(`CREATE INDEX IF NOT EXISTS reos_ai_usage_model ON reos_ai_usage(model)`))
  usageReady = true
}
export async function recordUsage(u: Omit<Usage, 'id'>): Promise<void> {
  const id = createHash('sha1').update(u.at + u.model + Math.round(u.ms) + u.tokens + Math.random()).digest('hex').slice(0, 16)
  if (pgEnabled()) {
    await ensureUsage()
    await pgTx(c => c.query(`INSERT INTO reos_ai_usage(id,at,task,model,provider,tokens,ms,cached,ok) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, u.at, u.task, u.model, u.provider || null, u.tokens, Math.round(u.ms), u.cached, u.ok])).catch(() => {})
  } else {
    let db: Usage[] = []; if (existsSync(USAGE_FILE)) { try { db = JSON.parse(readFileSync(USAGE_FILE, 'utf-8')) } catch {} }
    db.unshift({ id, ...u }); if (db.length > 5000) db.length = 5000
    try { writeFileSync(USAGE_FILE, JSON.stringify(db)) } catch {}
  }
}
export async function usageStats(): Promise<{ calls: number; tokens: number; cost: number; cacheHitRate: number; avgMs: number; byModel: Record<string, { calls: number; tokens: number; cost: number }> }> {
  let rows: Usage[] = []
  if (pgEnabled()) { await ensureUsage(); const r = await pgTx(c => c.query(`SELECT * FROM reos_ai_usage ORDER BY at DESC LIMIT 5000`)); rows = r.rows.map(x => ({ id: x.id, at: Number(x.at), task: x.task, model: x.model, provider: x.provider, tokens: Number(x.tokens), ms: x.ms, cached: x.cached, ok: x.ok })) }
  else if (existsSync(USAGE_FILE)) { try { rows = JSON.parse(readFileSync(USAGE_FILE, 'utf-8')) } catch {} }
  const byModel: Record<string, { calls: number; tokens: number; cost: number }> = {}
  let tokens = 0, cost = 0, cached = 0, ms = 0
  for (const r of rows) { tokens += r.tokens; const c = estimateCost(r.model, r.tokens); cost += c; if (r.cached) cached++; ms += r.ms; const m = byModel[r.model] || { calls: 0, tokens: 0, cost: 0 }; m.calls++; m.tokens += r.tokens; m.cost += c; byModel[r.model] = m }
  return { calls: rows.length, tokens, cost, cacheHitRate: rows.length ? Math.round((cached / rows.length) * 1000) / 10 : 0, avgMs: rows.length ? Math.round(ms / rows.length) : 0, byModel }
}

// ── هستهٔ Gateway: route → cache → call(+fallback) → record ──
export async function runLLM(
  task: LlmTask, messages: LlmMsg[],
  opts: { temperature?: number; max_tokens?: number; cache?: boolean; ttl?: number } = {},
  caller?: LlmCaller, now = Date.now(),
): Promise<LlmResult> {
  const { model, provider } = selectModel(task)
  const temp = opts.temperature ?? 0.2
  const key = cacheKey(model, messages, temp)
  if (opts.cache !== false) { const hit = cacheGet(key, opts.ttl ?? DEFAULT_TTL, now); if (hit) { await recordUsage({ at: now, task, model, provider, tokens: hit.tokens, ms: 0, cached: true, ok: true }); return { text: hit.text, model, provider, cached: true, tokens: hit.tokens, ms: 0, ok: true, fallback: false } } }

  const call = caller || realCaller
  const t0 = now
  try {
    const r = await call(model, messages, { temperature: temp, max_tokens: opts.max_tokens }, provider)
    const ms = Date.now() - t0
    if (opts.cache !== false) cacheSet(key, r.text, r.tokens, now)
    await recordUsage({ at: now, task, model, tokens: r.tokens, ms, cached: false, ok: true })
    return { text: r.text, model, provider, cached: false, tokens: r.tokens, ms, ok: true, fallback: false }
  } catch {
    // fallback به مدلِ ارزان/پایدار
    try {
      const r = await call(FALLBACK_MODEL, messages, { temperature: temp, max_tokens: opts.max_tokens })
      const ms = Date.now() - t0
      await recordUsage({ at: now, task, model: FALLBACK_MODEL, tokens: r.tokens, ms, cached: false, ok: true })
      return { text: r.text, model: FALLBACK_MODEL, cached: false, tokens: r.tokens, ms, ok: true, fallback: true }
    } catch {
      await recordUsage({ at: now, task, model, tokens: 0, ms: Date.now() - t0, cached: false, ok: false })
      return { text: '', model, cached: false, tokens: 0, ms: Date.now() - t0, ok: false, fallback: true }
    }
  }
}

// callerِ واقعی — GapGPT (توکن‌شمار). فقط در runtime؛ در تست، mock تزریق می‌شود.
const realCaller: LlmCaller = async (model, messages, opts, provider) => {
  const { chatCompleteUsage } = await import('../gapgpt')
  const r = await chatCompleteUsage(model, messages, opts, provider)
  return { text: r.text, tokens: r.tokens }
}

// راحتی: فراخوانِ ساده که فقط متن برمی‌گرداند (برای مصرف‌کننده‌های موجود).
export async function llm(task: LlmTask, messages: LlmMsg[], opts: { temperature?: number; max_tokens?: number; cache?: boolean } = {}): Promise<string> {
  return (await runLLM(task, messages, opts)).text
}
