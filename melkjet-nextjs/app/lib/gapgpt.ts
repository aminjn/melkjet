import { getAdminData } from './admin-store'
import { DEFAULT_GAP_BASE } from './ai-agents'
import { shecanRequest } from './shecan-https'

// تنظیماتِ یک provider را برمی‌گرداند. اگر providerId داده شده و موجود باشد، همان؛ وگرنه
// ارائه‌دهندهٔ پیش‌فرض (گپ = gapgpt). شناسه‌های 'gap'/'default' هم به پیش‌فرض اشاره می‌کنند.
function providerCfg(providerId?: string) {
  const a = getAdminData()
  if (providerId && providerId !== 'gap' && providerId !== 'default') {
    const p = a.providers?.[providerId]
    if (p?.apiKey) return { base: (p.baseUrl || DEFAULT_GAP_BASE).replace(/\/$/, ''), key: p.apiKey }
  }
  const g = a.gapgpt
  if (!g?.apiKey) throw new Error('کلید API تنظیم نشده است (پنل → API و مدل‌های AI)')
  return { base: (g.baseUrl || DEFAULT_GAP_BASE).replace(/\/$/, ''), key: g.apiKey }
}
function cfg(provider?: string) { return providerCfg(provider) }

export function agentModel(agentId: string, slot: 'text' | 'image' = 'text'): string | undefined {
  return getAdminData().agentModels?.[agentId]?.[slot]
}

// provider تخصیص‌داده‌شده به یک اسلاتِ ایجنت (خالی = پیش‌فرض/گپ).
export function agentProvider(agentId: string, slot: 'text' | 'image' = 'text'): string | undefined {
  const a = getAdminData().agentModels?.[agentId]
  return slot === 'image' ? a?.imageProvider : a?.textProvider
}

// از یک فهرستِ اولویتِ (ایجنت، اسلات)، اولین مدلِ تخصیص‌داده‌شده را همراه provider‌اش برمی‌گرداند.
export function resolveAgent(prefs: [string, 'text' | 'image'][]): { model?: string; provider?: string } {
  const am = getAdminData().agentModels || {}
  for (const [id, slot] of prefs) {
    const m = am[id]?.[slot]
    if (m) return { model: m, provider: slot === 'image' ? am[id]?.imageProvider : am[id]?.textProvider }
  }
  return {}
}

// GapGPT is a DOMESTIC service — always direct, NEVER via the (foreign) proxy,
// which breaks/empties its responses. We resolve DNS via Shecan inside the app
// (shecanRequest) so a reset/broken /etc/resolv.conf can no longer cause
// "fetch failed". If that path fails for any reason, fall back to plain fetch.
async function gapHttp(url: string, init: { method: string; headers: Record<string, string>; body?: string }, timeout = 90000): Promise<{ status: number; body: string }> {
  try {
    return await shecanRequest(url, { method: init.method, headers: init.headers, body: init.body, timeout })
  } catch (e) {
    const r = await fetch(url, { method: init.method, headers: init.headers, body: init.body, signal: AbortSignal.timeout(timeout) })
    return { status: r.status, body: await r.text() }
  }
}

export async function listModels(provider?: string): Promise<string[]> {
  const { base, key } = cfg(provider)
  const res = await gapHttp(`${base}/models`, { method: 'GET', headers: { Authorization: `Bearer ${key}`, accept: 'application/json' } }, 15000)
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  const d = JSON.parse(res.body)
  const ids: string[] = Array.isArray(d.data) ? d.data.map((m: any) => m.id).filter(Boolean) : []
  return ids.sort()
}

// قیمتِ مدل‌ها از خودِ API (OpenRouter/GapGPT: pricing.prompt/completion به‌ازای هر توکن).
// خروجی: $ به‌ازای هر ۱میلیون توکن. اگر قیمت خیلی کوچک بود (per-token) در ۱M ضرب می‌شود.
export interface ApiModelPrice { id: string; label: string; provider: string; type: 'text' | 'image' | 'audio' | 'embedding'; inUsd: number; outUsd: number }
export async function listModelsWithPricing(provider?: string): Promise<ApiModelPrice[]> {
  const { base, key } = cfg(provider)
  const res = await gapHttp(`${base}/models`, { method: 'GET', headers: { Authorization: `Bearer ${key}`, accept: 'application/json' } }, 20000)
  if (res.status !== 200) throw new Error(`گپ HTTP ${res.status}`)
  const d = JSON.parse(res.body)
  const arr: any[] = Array.isArray(d.data) ? d.data : []
  const scale = (v: any) => { const n = Number(v); if (!isFinite(n) || n <= 0) return 0; return n < 0.1 ? n * 1_000_000 : n }  // per-token→per-1M
  return arr.map(m => {
    const p = m.pricing || {}
    const inUsd = scale(p.prompt ?? p.input ?? m.input_price ?? m.inputPrice)
    const outUsd = scale(p.completion ?? p.output ?? m.output_price ?? m.outputPrice)
    const imgUsd = scale(p.image ?? p.image_generation)
    const id = String(m.id || '')
    const type: ApiModelPrice['type'] = /whisper|transcri|tts|speech|audio/i.test(id) ? 'audio'
      : /embedding/i.test(id) ? 'embedding'
      : (/image|dall-?e|imagen|z-image|flash-image/i.test(id) || (imgUsd > 0 && !outUsd)) ? 'image' : 'text'
    return { id, label: String(m.name || id), provider: String(m.owned_by || m.provider || (id.split(/[:/]/)[0])), type, inUsd: inUsd || imgUsd, outUsd: outUsd || imgUsd }
  }).filter(m => m.id && (m.inUsd > 0 || m.outUsd > 0))
}

export async function chatComplete(model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number } = {}, provider?: string): Promise<string> {
  const { base, key } = cfg(provider)
  const res = await gapHttp(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}`, accept: 'application/json' },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.max_tokens }),
  }, 90000)
  if (res.status !== 200) throw new Error(`گپ HTTP ${res.status}: ${res.body.slice(0, 300)}`)
  const d = JSON.parse(res.body)
  return d.choices?.[0]?.message?.content || ''
}

// Like chatComplete, but if the chosen model fails (e.g. 503/unavailable on
// GapGPT), retry once with a known-good cheap model so the feature still works.
export async function chatCompleteSafe(model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number } = {}, provider?: string): Promise<string> {
  try {
    return await chatComplete(model, messages, opts, provider)
  } catch (e) {
    if (model !== 'gpt-4o-mini') {
      return await chatComplete('gpt-4o-mini', messages, opts, provider)
    }
    throw e
  }
}

// مثلِ chatCompleteSafe ولی تعدادِ توکنِ مصرف‌شده را هم برمی‌گرداند (برای محاسبهٔ مصرفِ کاربر)
async function chatCompleteRaw(model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number } = {}, provider?: string): Promise<{ text: string; tokens: number }> {
  const { base, key } = cfg(provider)
  const res = await gapHttp(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}`, accept: 'application/json' },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.max_tokens }),
  }, 90000)
  if (res.status !== 200) throw new Error(`گپ HTTP ${res.status}: ${res.body.slice(0, 300)}`)
  const d = JSON.parse(res.body)
  return { text: d.choices?.[0]?.message?.content || '', tokens: Number(d.usage?.total_tokens) || 0 }
}
export async function chatCompleteUsage(model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number } = {}, provider?: string): Promise<{ text: string; tokens: number }> {
  try { return await chatCompleteRaw(model, messages, opts, provider) }
  catch (e) { if (model !== 'gpt-4o-mini') return await chatCompleteRaw('gpt-4o-mini', messages, opts, provider); throw e }
}

export async function generateImage(model: string, prompt: string, size = '1024x1024', provider?: string): Promise<string> {
  const { base, key } = cfg(provider)
  const res = await gapHttp(`${base}/images/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}`, accept: 'application/json' },
    body: JSON.stringify({ model, prompt, size, n: 1 }),
  }, 120000)
  if (res.status !== 200) throw new Error(`گپ تصویر HTTP ${res.status}: ${res.body.slice(0, 300)}`)
  const d = JSON.parse(res.body)
  const first = d.data?.[0] || {}
  // مدل‌هایی مثلِ gpt-image-1 خروجی را به‌صورتِ b64_json می‌دهند (بدون url) — به data URL تبدیل می‌کنیم.
  if (first.url) return first.url as string
  if (first.b64_json) return `data:image/png;base64,${first.b64_json}`
  return ''
}

// تحلیل تصویر (چندوجهی): تصاویر را همراه یک پرامپت متنی به مدل بینایی می‌دهد.
// images آرایه‌ای از data URL یا URL تصویر است (فرمت OpenAI vision).
export async function chatVision(model: string, prompt: string, images: string[], opts: { max_tokens?: number; timeout?: number } = {}, provider?: string): Promise<string> {
  const { base, key } = cfg(provider)
  const content: any[] = [{ type: 'text', text: prompt }]
  for (const img of images.slice(0, 8)) if (img) content.push({ type: 'image_url', image_url: { url: img } })
  const res = await gapHttp(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}`, accept: 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }], max_tokens: opts.max_tokens ?? 700, temperature: 0.4 }),
  }, opts.timeout ?? 45000)
  if (res.status !== 200) throw new Error(`گپ بینایی HTTP ${res.status}: ${res.body.slice(0, 300)}`)
  const d = JSON.parse(res.body)
  return d.choices?.[0]?.message?.content || ''
}

// مدل‌های بینایی معتبر روی گپ برای fallback (وقتی مدلِ انتخابی روی عکس 503/خطا می‌دهد).
// کوتاه نگه داشته‌ایم تا مجموع زمان از حد تایم‌اوت پراکسی رد نشود.
const VISION_FALLBACKS = ['gpt-4o', 'gpt-4o-mini']

export async function chatVisionSafe(model: string | undefined, prompt: string, images: string[], opts: { max_tokens?: number; timeout?: number } = {}, provider?: string): Promise<{ text: string; model: string }> {
  const candidates: string[] = []
  for (const m of [model, ...VISION_FALLBACKS]) if (m && !candidates.includes(m)) candidates.push(m)
  let lastErr: any = null
  for (const m of candidates) {
    try {
      const text = await chatVision(m, prompt, images, opts, provider)
      if (text && text.trim()) return { text, model: m }
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('هیچ مدل بینایی پاسخ نداد')
}

// مدل‌های تصویرِ رایج و معتبر برای fallback — gpt-image-1 (کیفیت و دنبال‌کردنِ دستور
// بهتر، موجود روی avalai) مقدم؛ سپس dall-e-3 و flux.
const IMAGE_FALLBACKS = ['gpt-image-1', 'dall-e-3', 'flux', 'dall-e-2']

// مثل generateImage ولی اگر مدلِ انتخابی نامعتبر بود (۴۰۴/خطای آپ‌استریم)، خودکار
// مدل‌های تصویرِ معتبر را امتحان می‌کند تا قابلیت با تنظیمِ اشتباهِ مدل از کار نیفتد.
export async function generateImageSafe(model: string | undefined, prompt: string, size = '1024x1024', provider?: string): Promise<{ url: string; model: string }> {
  const candidates: string[] = []
  for (const m of [model, ...IMAGE_FALLBACKS]) if (m && !candidates.includes(m)) candidates.push(m)
  let lastErr: any = null
  for (const m of candidates) {
    try {
      const url = await generateImage(m, prompt, size, provider)
      if (url) return { url, model: m }
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('هیچ مدل تصویری پاسخ نداد')
}
