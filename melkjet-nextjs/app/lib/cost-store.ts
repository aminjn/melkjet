import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// هزینهٔ واقعیِ مدل‌های AI (از تأمین‌کننده مثلِ GapGPT) + نرخِ تبدیل → قیمتِ فروشِ توکن/تصویر.
// همه از پنلِ سوپرادمین قابلِ ویرایش. قیمت‌ها به دلار به‌ازای هر ۱میلیون توکن (متن) یا هر تصویر.
const FILE = join(process.cwd(), '.cost-data.json')
const SEED_V = 1

export interface ModelCost { id: string; label: string; provider: string; type: 'text' | 'image' | 'audio' | 'embedding'; inUsd: number; outUsd: number }
export interface CostConfig {
  usdToman: number        // نرخِ دلار به تومان
  markup: number          // ضریبِ سود (۲ = دو برابرِ هزینه)
  referenceModelId: string // مدلی که قیمتِ فروشِ توکن از رویش حساب می‌شود
  unitTokens: Record<string, number> // مصرفِ توکنِ هر عملیاتِ غیرمتنی (تصویر/رندر/ایمپورت/تماس)
  models: ModelCost[]
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
    usdToman: 700000, markup: 2, referenceModelId: 'gapgpt-qwen-3.6',
    unitTokens: { image: 2000, render3d: 20000, divarImport: 1000, contactReveal: 5000, sms: 500, email: 200 },
    models: seedModels(), v: SEED_V,
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
  if (patch.referenceModelId !== undefined) c.referenceModelId = String(patch.referenceModelId)
  if (patch.unitTokens) c.unitTokens = { ...c.unitTokens, ...patch.unitTokens }
  if (Array.isArray(patch.models)) c.models = patch.models.map(m => ({ id: String(m.id || '').trim(), label: String(m.label || m.id || '').trim(), provider: String(m.provider || '').trim(), type: (['text', 'image', 'audio', 'embedding'] as const).includes(m.type as any) ? m.type as any : 'text', inUsd: Number(m.inUsd) || 0, outUsd: Number(m.outUsd) || 0 })).filter(m => m.id)
  save(c); return c
}
// قیمتِ فروشِ هر توکن (تومان) = هزینهٔ خروجیِ مدلِ مرجع × نرخِ دلار × ضریبِ سود.
export function tokenSellPriceToman(): number {
  const c = load()
  const m = c.models.find(x => x.id === c.referenceModelId) || c.models[0]
  if (!m) return 0
  const costPerTokenUsd = (m.outUsd || m.inUsd) / 1_000_000
  return costPerTokenUsd * c.usdToman * c.markup
}
