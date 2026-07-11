import { getAdminData } from './admin-store'
import { recordAiUse, callerSrcOf, noteModelResult, modelDown } from './ai-usage-store'   // فاز ۵۴: دفترِ جزءبه‌جزِ مصرفِ AI
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
  }).filter(m => m.id && (m.inUsd > 0 || m.outUsd > 0 || m.type === 'text' || m.type === 'image'))
  // فاز ۸۳ (فیدبک: «همهٔ مدل‌های گپ در جدولِ قیمت نیست»): گپ برای خیلی از مدل‌ها فیلدِ pricing
  // برنمی‌گرداند — قبلاً کلاً حذف می‌شدند و ادمین حتی نمی‌توانست دستی قیمت بدهد. حالا با قیمتِ ۰
  // (= «ثبت‌نشده») می‌آیند تا در جدول دیده و دستی پر شوند؛ تا قیمت نگیرند در صرفه‌جویی شرکت نمی‌کنند.
}

// فاز ۸۵ (فیدبک: «قرار بود خودش اتومات بگیرد و هر روز آپدیت کند»): APIِ گپ برای خیلی از مدل‌ها قیمت
// نمی‌فرستد؛ تنها منبعِ کامل صفحهٔ قیمتِ سایتِ خودِ گپ است. این تابع سمتِ سرور همان صفحه/چند endpoint
// محتمل را می‌کِشد و با اسکنِ عمیقِ JSONهای داخلِ صفحه (__NEXT_DATA__/flight/blobها) قیمت‌ها را درمی‌آورد.
// هر منبع که جواب داد در note گزارش می‌شود — اگر ساختارِ سایتِ گپ عوض شود، از همان پیام معلوم می‌شود.
export async function fetchGapSitePricing(): Promise<{ list: ApiModelPrice[]; note: string }> {
  const tried: string[] = []
  const out = new Map<string, ApiModelPrice>()
  const scale = (v: any) => { const n = Number(String(v ?? '').replace(/[$,\s]/g, '')); if (!isFinite(n) || n <= 0) return 0; return n < 0.1 ? n * 1_000_000 : n }
  const slugRe = /^[a-z][\w.\/-]{2,60}$/i
  const put = (id: string, inU: number, outU: number, provider = '') => {
    if (!slugRe.test(id) || (!inU && !outU)) return
    const type: ApiModelPrice['type'] = /image|dall-?e|imagen|z-image|flash-image/i.test(id) ? 'image' : 'text'
    const ex = out.get(id)
    if (!ex || (inU && !ex.inUsd) || (outU && !ex.outUsd)) out.set(id, { id, label: id, provider, type, inUsd: inU || ex?.inUsd || 0, outUsd: outU || ex?.outUsd || 0 })
  }
  // اسکنِ عمیقِ هر مقدارِ JSON: هر آبجکتی که «شناسهٔ مدل + فیلدِ قیمتِ ورودی/خروجی» داشته باشد
  const deepScan = (v: any) => {
    if (!v) return
    if (Array.isArray(v)) { for (const x of v) deepScan(x); return }
    if (typeof v === 'object') {
      const id = String(v.id || v.model || v.slug || v.name || '')
      const inU = scale(v.input ?? v.input_price ?? v.inputPrice ?? v.prompt ?? v.prompt_price ?? v.in)
      const outU = scale(v.output ?? v.output_price ?? v.outputPrice ?? v.completion ?? v.completion_price ?? v.out)
      if (id && (inU || outU)) put(id, inU, outU, String(v.provider || v.owned_by || v.vendor || ''))
      for (const k of Object.keys(v)) deepScan(v[k])
    }
  }
  const scanText = (txt: string) => {
    // JSONهای خالص
    try { deepScan(JSON.parse(txt)) } catch {}
    // __NEXT_DATA__ / بلاب‌های JSON داخلِ HTML (بزرگ‌ترین آبجکت‌ها)
    for (const m of txt.matchAll(/<script[^>]*>\s*(\{[\s\S]*?\})\s*<\/script>/g)) { try { deepScan(JSON.parse(m[1])) } catch {} }
    // رشته‌های escape شدهٔ flight (self.__next_f.push("...")) — unescape و دوباره الگوگیری
    const un = txt.replace(/\\"/g, '"')
    // الگوی متنی: "id":"gpt-x" ... input/prompt: 1.25 ... output/completion: 10
    for (const m of un.matchAll(/"(?:id|model|slug)"\s*:\s*"([\w.\/-]{3,60})"([^{}]{0,400}?)"(?:input|prompt)[^"]*"\s*:\s*"?\$?([\d.]+)"?([^{}]{0,200}?)"(?:output|completion)[^"]*"\s*:\s*"?\$?([\d.]+)"?/g)) {
      put(m[1], scale(m[3]), scale(m[5]))
    }
  }
  const urls = [
    'https://gapgpt.app/platform-v2/pricing',
    'https://api.gapgpt.app/v1/pricing',
    'https://gapgpt.app/api/pricing',
    'https://api.gapgpt.app/v1/models/pricing',
  ]
  for (const u of urls) {
    try {
      const res = await gapHttp(u, { method: 'GET', headers: { accept: 'text/html,application/json', 'user-agent': 'Mozilla/5.0 (melkjet-pricing-sync)' } }, 25000)
      const before = out.size
      if (res.status === 200 && res.body) scanText(res.body)
      tried.push(`${u.replace('https://', '')}: HTTP ${res.status}${out.size > before ? ` → ${out.size - before} قیمت` : ''}`)
      if (out.size >= 10) break   // به‌قدرِ کافی گرفتیم
    } catch (e: any) { tried.push(`${u.replace('https://', '')}: ${String(e?.message || e).slice(0, 60)}`) }
  }
  return { list: [...out.values()], note: tried.join(' · ') }
}

export async function chatComplete(model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number; src?: string; timeoutMs?: number } = {}, provider?: string): Promise<string> {
  const { base, key } = cfg(provider)
  // فاز ۵۷: src صریح مقدم است — در بیلدِ پروداکشن stack مسیرِ app/ را ندارد و «ناشناخته» می‌شد
  const src54 = opts.src || callerSrcOf(new Error().stack), t54 = Date.now()
  try {
    const res = await gapHttp(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}`, accept: 'application/json' },
      body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.max_tokens }),
    }, Math.max(5000, opts.timeoutMs || 90000))
    if (res.status !== 200) throw new Error(`گپ HTTP ${res.status}: ${res.body.slice(0, 300)}`)
    const d = JSON.parse(res.body)
    recordAiUse({ src: src54, model, kind: 'text', tokens: Number(d.usage?.total_tokens) || 0, ok: true, ms: Date.now() - t54 }).catch(() => {})
    noteModelResult(model, true)
    return d.choices?.[0]?.message?.content || ''
  } catch (e: any) {
    // فاز ۷۸: متنِ خطا در دفترِ مصرف ثبت می‌شود + مدارشکنِ مدلِ خراب
    noteModelResult(model, false)
    recordAiUse({ src: src54, model, kind: 'text', tokens: 0, ok: false, ms: Date.now() - t54, err: e?.message || String(e) }).catch(() => {})
    throw e
  }
}

// Like chatComplete, but if the chosen model fails (e.g. 503/unavailable on
// GapGPT), retry once with a known-good cheap model so the feature still works.
export async function chatCompleteSafe(model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number; src?: string } = {}, provider?: string): Promise<string> {
  // فاز ۷۸ (مدارشکن): مدلی که چند بارِ پیاپی شکست خورده، تا مدتی مستقیم دور زده می‌شود —
  // دیگر هر درخواست یک تماسِ سوخته + تأخیرِ ۹۰ثانیه‌ای خرجِ مدلِ خراب نمی‌کند.
  if (model !== 'gpt-4o-mini' && modelDown(model)) {
    return await chatComplete('gpt-4o-mini', messages, opts, provider)
  }
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
async function chatCompleteRaw(model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number; src?: string } = {}, provider?: string): Promise<{ text: string; tokens: number }> {
  // فاز ۷۸: مسیرِ چت/اعتبارِ کاربر هم مدارشکن + ثبتِ خطا + fallback دارد — مدلِ خراب تجربهٔ کاربر را نمی‌کُشد
  if (model !== 'gpt-4o-mini' && modelDown(model)) model = 'gpt-4o-mini'
  const { base, key } = cfg(provider)
  const attempt = async (m: string) => {
    const res = await gapHttp(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}`, accept: 'application/json' },
      body: JSON.stringify({ model: m, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.max_tokens }),
    }, 90000)
    if (res.status !== 200) throw new Error(`گپ HTTP ${res.status}: ${res.body.slice(0, 300)}`)
    const d = JSON.parse(res.body)
    recordAiUse({ src: opts.src || callerSrcOf(new Error().stack), model: m, kind: 'text', tokens: Number(d.usage?.total_tokens) || 0, ok: true, ms: 0 }).catch(() => {})   // فاز ۵۴
    noteModelResult(m, true)
    return { text: d.choices?.[0]?.message?.content || '', tokens: Number(d.usage?.total_tokens) || 0 }
  }
  try {
    return await attempt(model)
  } catch (e: any) {
    noteModelResult(model, false)
    recordAiUse({ src: opts.src || callerSrcOf(new Error().stack), model, kind: 'text', tokens: 0, ok: false, ms: 0, err: e?.message || String(e) }).catch(() => {})
    if (model !== 'gpt-4o-mini') return await attempt('gpt-4o-mini')
    throw e
  }
}
export async function chatCompleteUsage(model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number; src?: string } = {}, provider?: string): Promise<{ text: string; tokens: number }> {
  try { return await chatCompleteRaw(model, messages, opts, provider) }
  catch (e) { if (model !== 'gpt-4o-mini') return await chatCompleteRaw('gpt-4o-mini', messages, opts, provider); throw e }
}

export async function generateImage(model: string, prompt: string, size = '1024x1024', provider?: string, src?: string): Promise<string> {
  const { base, key } = cfg(provider)
  const res = await gapHttp(`${base}/images/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}`, accept: 'application/json' },
    body: JSON.stringify({ model, prompt, size, n: 1 }),
  }, 120000)
  if (res.status !== 200) { recordAiUse({ src: src || callerSrcOf(new Error().stack), model, kind: 'image', tokens: 0, ok: false, ms: 0 }).catch(() => {}); throw new Error(`گپ تصویر HTTP ${res.status}: ${res.body.slice(0, 300)}`) }
  recordAiUse({ src: src || callerSrcOf(new Error().stack), model, kind: 'image', tokens: 0, ok: true, ms: 0 }).catch(() => {})   // فاز ۵۴
  const d = JSON.parse(res.body)
  const first = d.data?.[0] || {}
  // مدل‌هایی مثلِ gpt-image-1 خروجی را به‌صورتِ b64_json می‌دهند (بدون url) — به data URL تبدیل می‌کنیم.
  if (first.url) return first.url as string
  if (first.b64_json) return `data:image/png;base64,${first.b64_json}`
  return ''
}

// تحلیل تصویر (چندوجهی): تصاویر را همراه یک پرامپت متنی به مدل بینایی می‌دهد.
// images آرایه‌ای از data URL یا URL تصویر است (فرمت OpenAI vision).
export async function chatVision(model: string, prompt: string, images: string[], opts: { max_tokens?: number; timeout?: number; src?: string } = {}, provider?: string): Promise<string> {
  const { base, key } = cfg(provider)
  const content: any[] = [{ type: 'text', text: prompt }]
  for (const img of images.slice(0, 8)) if (img) content.push({ type: 'image_url', image_url: { url: img } })
  const res = await gapHttp(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}`, accept: 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }], max_tokens: opts.max_tokens ?? 700, temperature: 0.4 }),
  }, opts.timeout ?? 45000)
  if (res.status !== 200) { recordAiUse({ src: opts.src || callerSrcOf(new Error().stack), model, kind: 'vision', tokens: 0, ok: false, ms: 0 }).catch(() => {}); throw new Error(`گپ بینایی HTTP ${res.status}: ${res.body.slice(0, 300)}`) }
  const d = JSON.parse(res.body)
  recordAiUse({ src: opts.src || callerSrcOf(new Error().stack), model, kind: 'vision', tokens: Number(d.usage?.total_tokens) || 0, ok: true, ms: 0 }).catch(() => {})   // فاز ۵۴
  return d.choices?.[0]?.message?.content || ''
}

// مدل‌های بینایی معتبر روی گپ برای fallback (وقتی مدلِ انتخابی روی عکس 503/خطا می‌دهد).
// کوتاه نگه داشته‌ایم تا مجموع زمان از حد تایم‌اوت پراکسی رد نشود.
const VISION_FALLBACKS = ['gpt-4o', 'gpt-4o-mini']

export async function chatVisionSafe(model: string | undefined, prompt: string, images: string[], opts: { max_tokens?: number; timeout?: number; src?: string } = {}, provider?: string): Promise<{ text: string; model: string }> {
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
export async function generateImageSafe(model: string | undefined, prompt: string, size = '1024x1024', provider?: string, src?: string): Promise<{ url: string; model: string }> {
  const candidates: string[] = []
  for (const m of [model, ...IMAGE_FALLBACKS]) if (m && !candidates.includes(m)) candidates.push(m)
  let lastErr: any = null
  for (const m of candidates) {
    try {
      const url = await generateImage(m, prompt, size, provider, src)
      if (url) return { url, model: m }
    } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('هیچ مدل تصویری پاسخ نداد')
}

// ── فاز ۵۷ (فیدبک: «همه ناشناخته است») — منبعِ صریحِ مصرف ──────────────────
// هر ماژول یک‌بار aiFor('نامِ فارسیِ فیچر') می‌سازد و همان توابعِ همیشگی را صدا می‌زند؛
// برچسب به دفترِ مصرفِ AI می‌رود. در بیلدِ پروداکشن stack مسیرِ app/ را ندارد و تشخیصِ
// خودکار «ناشناخته» می‌شد — منبعِ صریح تنها راهِ قطعی است.
export function aiFor(src: string) {
  return {
    chatComplete: (model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number; timeoutMs?: number } = {}, provider?: string) =>
      chatComplete(model, messages, { ...opts, src }, provider),
    chatCompleteSafe: (model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number } = {}, provider?: string) =>
      chatCompleteSafe(model, messages, { ...opts, src }, provider),
    chatCompleteUsage: (model: string, messages: { role: string; content: string }[], opts: { temperature?: number; max_tokens?: number } = {}, provider?: string) =>
      chatCompleteUsage(model, messages, { ...opts, src }, provider),
    chatVision: (model: string, prompt: string, images: string[], opts: { max_tokens?: number; timeout?: number } = {}, provider?: string) =>
      chatVision(model, prompt, images, { ...opts, src }, provider),
    chatVisionSafe: (model: string | undefined, prompt: string, images: string[], opts: { max_tokens?: number; timeout?: number } = {}, provider?: string) =>
      chatVisionSafe(model, prompt, images, { ...opts, src }, provider),
    generateImage: (model: string, prompt: string, size = '1024x1024', provider?: string) =>
      generateImage(model, prompt, size, provider, src),
    generateImageSafe: (model: string | undefined, prompt: string, size = '1024x1024', provider?: string) =>
      generateImageSafe(model, prompt, size, provider, src),
  }
}
