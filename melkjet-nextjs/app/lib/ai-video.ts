import { getAdminData } from './admin-store'
import { DEFAULT_GAP_BASE } from './ai-agents'
import { shecanRequest } from './shecan-https'

// تولیدِ ویدئو با سرویسِ AI سازگارِ OpenAI (avalai): الگوی async — ثبتِ کار، سپس
// poll تا آماده‌شدن. هم متن‌به‌ویدئو و هم عکس‌به‌ویدئو (image-to-video) را پوشش می‌دهد.

function cfg() {
  const g = getAdminData().gapgpt
  if (!g?.apiKey) throw new Error('کلید API تنظیم نشده است (پنل → API و مدل‌های AI)')
  return { base: (g.baseUrl || DEFAULT_GAP_BASE).replace(/\/$/, ''), key: g.apiKey }
}

async function http(url: string, init: { method: string; headers: Record<string, string>; body?: string }, timeout = 60000): Promise<{ status: number; body: string }> {
  try {
    return await shecanRequest(url, { method: init.method, headers: init.headers, body: init.body, timeout })
  } catch {
    const r = await fetch(url, { method: init.method, headers: init.headers, body: init.body, signal: AbortSignal.timeout(timeout) })
    return { status: r.status, body: await r.text() }
  }
}

// مدل‌های ویدئوی رایج روی avalai برای fallback (وقتی کاربر مدل مشخص نکرده).
const VIDEO_FALLBACKS = ['sora-2', 'veo-3', 'veo-2', 'runway/gen4_turbo', 'gen4_turbo', 'kling-video/v1.6']

// آدرسِ ویدئو را از شکل‌های مختلفِ پاسخ بیرون می‌کشد.
function pickVideoUrl(d: any): string {
  if (!d || typeof d !== 'object') return ''
  const cands = [
    d.url, d.video_url, d.video?.url, d.result?.url, d.result?.video_url,
    Array.isArray(d.data) ? (d.data[0]?.url || d.data[0]?.video_url) : d.data?.url,
    Array.isArray(d.output) ? (typeof d.output[0] === 'string' ? d.output[0] : d.output[0]?.url) : (typeof d.output === 'string' ? d.output : d.output?.url),
    d.assets?.video, d.response?.video_url,
  ]
  for (const c of cands) if (typeof c === 'string' && /^https?:\/\//.test(c) && /\.(mp4|webm|mov)|video/i.test(c)) return c
  // اگر url عمومیِ ویدئویی نبود ولی یک url کلی هست، همان را برگردان
  for (const c of cands) if (typeof c === 'string' && /^https?:\/\//.test(c)) return c
  return ''
}

function statusOf(d: any): string {
  return String(d?.status || d?.state || d?.data?.status || '').toLowerCase()
}

const DONE = ['completed', 'succeeded', 'success', 'done', 'finished', 'ready']
const FAILED = ['failed', 'error', 'canceled', 'cancelled', 'rejected']

// poll کارِ ویدئو تا آماده شدن (تا ~۴ دقیقه).
async function pollVideo(base: string, key: string, id: string): Promise<string> {
  const headers = { Authorization: `Bearer ${key}`, accept: 'application/json' }
  const start = Date.now()
  let delay = 4000
  while (Date.now() - start < 240000) {
    await new Promise(r => setTimeout(r, delay))
    delay = Math.min(delay + 1500, 10000)
    let res
    try { res = await http(`${base}/videos/${encodeURIComponent(id)}`, { method: 'GET', headers }, 30000) } catch { continue }
    if (res.status !== 200) continue
    let d: any = null
    try { d = JSON.parse(res.body) } catch { continue }
    const st = statusOf(d)
    const url = pickVideoUrl(d)
    if (url) return url
    if (DONE.includes(st)) { const u = pickVideoUrl(d); if (u) return u }
    if (FAILED.includes(st)) throw new Error(`ساختِ ویدئو ناموفق شد (${d?.error?.message || d?.error || st})`)
  }
  throw new Error('زمانِ ساختِ ویدئو طولانی شد (تایم‌اوت). دوباره تلاش کنید یا مدلِ سریع‌تری انتخاب کنید.')
}

export interface VideoOpts { model?: string; imageUrl?: string; seconds?: number; size?: string }

/** یک ویدئو می‌سازد. اگر imageUrl بدهی، عکس‌به‌ویدئو (واک‌تر)؛ وگرنه متن‌به‌ویدئو. */
export async function generateVideo(prompt: string, opts: VideoOpts = {}): Promise<{ url: string; model: string }> {
  const { base, key } = cfg()
  const headers = { 'content-type': 'application/json', Authorization: `Bearer ${key}`, accept: 'application/json' }
  const seconds = String(opts.seconds || 5)
  const size = opts.size || '1280x720'
  const candidates: string[] = []
  for (const m of [opts.model, ...VIDEO_FALLBACKS]) if (m && !candidates.includes(m)) candidates.push(m)

  let lastErr: any = null
  for (const model of candidates) {
    try {
      const payload: any = { model, prompt, seconds, size }
      // image-to-video: نامِ فیلدِ تصویر بین سرویس‌ها فرق دارد؛ رایج‌ترین‌ها را می‌فرستیم.
      if (opts.imageUrl) { payload.image = opts.imageUrl; payload.input_reference = opts.imageUrl; payload.image_url = opts.imageUrl }
      const res = await http(`${base}/videos`, { method: 'POST', headers, body: JSON.stringify(payload) }, 60000)
      if (res.status !== 200 && res.status !== 201 && res.status !== 202) { lastErr = new Error(`HTTP ${res.status}: ${res.body.slice(0, 200)}`); continue }
      let d: any = null
      try { d = JSON.parse(res.body) } catch { lastErr = new Error('پاسخِ نامعتبر از سرویس ویدئو'); continue }
      // گاهی همان لحظه url می‌دهد
      let url = pickVideoUrl(d)
      const id = d.id || d.data?.id || d.video?.id || d.result?.id
      if (!url && id) url = await pollVideo(base, key, String(id))
      if (url) return { url, model }
      lastErr = new Error('سرویس ویدئو خروجی قابلِ‌استفاده‌ای نداد')
    } catch (e: any) { lastErr = e }
  }
  throw lastErr || new Error('هیچ مدلِ ویدئویی پاسخ نداد')
}
