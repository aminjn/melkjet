import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// هزینهٔ واقعیِ مدل‌های AI (از تأمین‌کننده مثلِ GapGPT) + نرخِ تبدیل → قیمتِ فروشِ توکن/تصویر.
// همه از پنلِ سوپرادمین قابلِ ویرایش. قیمت‌ها به دلار به‌ازای هر ۱میلیون توکن (متن) یا هر تصویر.
const FILE = join(process.cwd(), '.cost-data.json')
const SEED_V = 1

export interface ModelCost { id: string; label: string; provider: string; type: 'text' | 'image' | 'audio' | 'embedding'; inUsd: number; outUsd: number }
export interface CostConfig {
  usdToman: number        // نرخِ دلار به تومان
  markup: number          // (قدیمی) ضریبِ سود — با profitPercent جایگزین شد
  profitPercent: number   // درصدِ سود (۱۰۰ = دو برابرِ هزینه)
  roundTo: number         // گِردکردنِ قیمتِ بسته (مثلاً ۱۰۰۰ تومان)
  costBasis: 'output' | 'avg' | 'sum'  // مبنای هزینه: فقط خروجی / میانگینِ ورودی و خروجی / مجموع
  referenceModelId: string // مدلی که قیمتِ فروشِ توکن از رویش حساب می‌شود
  unitTokens: Record<string, number> // مصرفِ توکنِ هر عملیاتِ غیرمتنی (تصویر/رندر/ایمپورت/تماس)
  models: ModelCost[]
  autoSync?: boolean      // دریافتِ هفتگیِ خودکارِ قیمت‌ها از API
  autoReprice?: boolean   // پس از سینک، قیمتِ بسته‌های توکن هم خودکار به‌روز شود
  lastSyncAt?: number
  v?: number
}

function seedModels(): ModelCost[] {
  const T = (id: string, provider: string, inUsd: number, outUsd: number): ModelCost => ({ id, label: id, provider, type: 'text', inUsd, outUsd })
  const I = (id: string, provider: string, inUsd: number, outUsd = 0): ModelCost => ({ id, label: id, provider, type: 'image', inUsd, outUsd })
  return [
    // متن ($/1M توکن: ورودی / خروجی)
    T('gapgpt-qwen-3.5', 'GapGPT', 0.25, 2.0), T('gapgpt-qwen-3.5-thinking', 'GapGPT', 0.25, 2.0),
    T('gapgpt-qwen-3.6', 'GapGPT', 0.25, 2.0), T('gapgpt-qwen-3.6-thinking', 'GapGPT', 0.25, 2.0),
    T('gpt-5.2', 'OpenAI', 1.75, 14.0), T('gpt-5.2-chat-latest', 'OpenAI', 1.75, 14.0), T('gpt-5.2-codex', 'OpenAI', 1.75, 14.0),
    T('gpt-5.2-pro', 'OpenAI', 21.0, 168.0), T('gpt-5.3-chat-latest', 'OpenAI', 1.75, 14.0), T('gpt-5.3-codex-spark', 'OpenAI', 1.75, 14.0),
    T('claude-opus-4-1', 'Anthropic', 15.0, 75.0), T('claude-opus-4', 'Anthropic', 15.0, 75.0),
    T('claude-opus-4-5', 'Anthropic', 5.0, 25.0), T('claude-opus-4-6', 'Anthropic', 5.0, 25.0),
    T('claude-opus-4-7', 'Anthropic', 5.0, 25.0), T('claude-opus-4-8', 'Anthropic', 5.0, 25.0),
    T('claude-sonnet-4', 'Anthropic', 3.0, 15.0), T('claude-sonnet-4-5', 'Anthropic', 3.0, 15.0),
    T('claude-sonnet-4-6', 'Anthropic', 3.0, 15.0), T('claude-sonnet-5', 'Anthropic', 2.0, 10.0),
    // تصویر ($ — بسته به مدل: به‌ازای هر تصویر یا هر ۱M توکن)
    I('gapgpt/z-image', 'GapGPT', 0.005), I('gpt-image-2', 'OpenAI', 8.0, 30.0), I('gpt-image-1', 'OpenAI', 10.0, 40.0),
    I('gpt-image-1-mini', 'OpenAI', 2.0, 4.0), I('gpt-image-1.5', 'OpenAI', 8.0, 40.0), I('dall-e-3', 'OpenAI', 0.04),
    I('gemini-3-pro-image-preview', 'Google', 2.0, 120.0), I('gemini-2.5-flash-image', 'Google', 0.04),
    I('gemini-3.1-flash-image-preview', 'Google', 0.08), I('imagen-4.0-fast', 'Google', 0.02),
    I('imagen-4.0-generate', 'Google', 0.04), I('imagen-4.0-ultra', 'Google', 0.06),
  ]
}
function defaults(): CostConfig {
  return {
    usdToman: 700000, markup: 2, profitPercent: 100, roundTo: 1000, costBasis: 'sum', referenceModelId: 'gapgpt-qwen-3.6',
    unitTokens: { image: 2000, render3d: 20000, divarImport: 1000, contactReveal: 5000, sms: 500, email: 200 },
    models: seedModels(), autoSync: true, autoReprice: true, lastSyncAt: 0, v: SEED_V,
  }
}
function load(): CostConfig {
  if (existsSync(FILE)) {
    try {
      const d = JSON.parse(readFileSync(FILE, 'utf-8')) as CostConfig
      if (d && d.v === SEED_V) return { ...defaults(), ...d, models: d.models?.length ? d.models : seedModels(), unitTokens: { ...defaults().unitTokens, ...(d.unitTokens || {}) } }
    } catch {}
  }
  const d = defaults(); save(d); return d
}
function save(c: CostConfig) { c.v = SEED_V; writeFileSync(FILE, JSON.stringify(c, null, 2), 'utf-8') }

export function getCostConfig(): CostConfig { return load() }
export function setCostConfig(patch: Partial<CostConfig>): CostConfig {
  const c = load()
  if (patch.usdToman !== undefined) c.usdToman = Math.max(0, Number(patch.usdToman) || 0)
  if (patch.markup !== undefined) c.markup = Math.max(1, Number(patch.markup) || 1)
  if (patch.profitPercent !== undefined) c.profitPercent = Math.max(0, Number(patch.profitPercent) || 0)
  if (patch.roundTo !== undefined) c.roundTo = Math.max(1, Number(patch.roundTo) || 1)
  if (patch.costBasis !== undefined) c.costBasis = (['output', 'avg', 'sum'] as const).includes(patch.costBasis as any) ? patch.costBasis as any : c.costBasis
  if (patch.autoSync !== undefined) c.autoSync = !!patch.autoSync
  if (patch.autoReprice !== undefined) c.autoReprice = !!patch.autoReprice
  if (patch.referenceModelId !== undefined) c.referenceModelId = String(patch.referenceModelId)
  if (patch.unitTokens) c.unitTokens = { ...c.unitTokens, ...patch.unitTokens }
  if (Array.isArray(patch.models)) c.models = patch.models.map(m => ({ id: String(m.id || '').trim(), label: String(m.label || m.id || '').trim(), provider: String(m.provider || '').trim(), type: (['text', 'image', 'audio', 'embedding'] as const).includes(m.type as any) ? m.type as any : 'text', inUsd: Number(m.inUsd) || 0, outUsd: Number(m.outUsd) || 0 })).filter(m => m.id)
  save(c); return c
}
// ادغامِ قیمت‌های دریافت‌شده از API با فهرستِ مدل‌ها (به‌روزرسانی + افزودنِ مدلِ جدید).
export function syncModels(fetched: { id: string; label?: string; provider?: string; type?: string; inUsd: number; outUsd: number }[]): { updated: number; added: number } {
  const c = load(); const byId = new Map(c.models.map(m => [m.id, m]))
  let updated = 0, added = 0
  for (const f of fetched) {
    if (!f.id) continue
    const ex = byId.get(f.id)
    // فاز ۸۳: سینک هرگز قیمتِ واردشدهٔ دستی را صفر نمی‌کند — فقط قیمتِ «واقعیِ» تازه جایگزین می‌شود
    if (ex) { if (Number(f.inUsd) > 0) ex.inUsd = Number(f.inUsd); if (Number(f.outUsd) > 0) ex.outUsd = Number(f.outUsd); if (f.label) ex.label = f.label; if (f.provider) ex.provider = f.provider; if (f.type) ex.type = f.type as any; updated++ }
    else { c.models.push({ id: f.id, label: f.label || f.id, provider: f.provider || '', type: (['text', 'image', 'audio', 'embedding'].includes(f.type as any) ? f.type : 'text') as any, inUsd: Number(f.inUsd) || 0, outUsd: Number(f.outUsd) || 0 }); added++ }
  }
  save(c); return { updated, added }
}
// سینکِ هفتگیِ خودکارِ قیمت‌ها از API (از کرونِ اینستنسِ ۰). قیمتِ مدل‌ها را می‌گیرد،
// و در صورتِ فعال‌بودن، قیمتِ بسته‌های توکن را هم به‌روز می‌کند.
declare global { // eslint-disable-next-line no-var
  var __mjCostSyncing: boolean | undefined
}
export async function maybeAutoSyncCost(now = Date.now()): Promise<boolean> {
  const c = load()
  if (c.autoSync === false) return false
  const WEEK = 7 * 24 * 3600 * 1000
  if ((c.lastSyncAt || 0) && now - (c.lastSyncAt || 0) < WEEK) return false
  if (globalThis.__mjCostSyncing) return false
  globalThis.__mjCostSyncing = true
  try {
    const { listModelsWithPricing } = await import('./gapgpt')
    const fetched = await listModelsWithPricing()
    if (fetched.length) {
      syncModels(fetched)
      if (load().autoReprice !== false) {
        const { repriceTokenPackages } = await import('./comm-store')
        repriceTokenPackages(tokenSellPriceToman(), load().roundTo)
      }
    }
  } catch { /* اگر API قیمت نداد، فقط زمانِ سینک را ثبت کن تا هفتهٔ بعد دوباره تلاش شود */ }
  finally { const c2 = load(); c2.lastSyncAt = now; save(c2); globalThis.__mjCostSyncing = false }
  return true
}

// هزینهٔ هر ۱میلیون توکنِ یک مدل ($) بر اساسِ مبنای انتخابی (خروجی/میانگین/مجموعِ ورودی+خروجی).
export function modelCostPerMUsd(m: { inUsd: number; outUsd: number }, basis: 'output' | 'avg' | 'sum'): number {
  const inU = Number(m.inUsd) || 0, outU = Number(m.outUsd) || 0
  if (basis === 'sum') return inU + outU
  if (basis === 'avg') return (inU + outU) / 2
  return outU || inU
}
// قیمتِ فروشِ هر توکن (تومان) = هزینهٔ مدلِ مرجع (طبقِ مبنا) × نرخِ دلار × (۱ + درصدِ سود/۱۰۰).
export function tokenSellPriceToman(): number {
  const c = load()
  const m = c.models.find(x => x.id === c.referenceModelId) || c.models[0]
  if (!m) return 0
  const costPerTokenUsd = modelCostPerMUsd(m, c.costBasis || 'sum') / 1_000_000
  return costPerTokenUsd * c.usdToman * (1 + (Number(c.profitPercent) || 0) / 100)
}
