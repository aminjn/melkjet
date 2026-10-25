// فاز ۳۲۶ — سرویس‌های هوش مصنوعیِ «خودِ مالک» روی سرورِ GPU (از طریقِ تونلِ محلی).
// همه opt-in و قابلِ تنظیم از سوپرادمین؛ تا وقتی baseUrl ندهی و روشن نکنی، رفتارِ فعلی عوض نمی‌شود.
// endpointها http://127.0.0.1:<port> هستند (تونلِ SSH) — gapHttp/shecan دخالت نمی‌کند، مستقیم fetch.
import { saveMedia } from './media-store'
import { getAdminData } from './admin-store'

export type SelfHostKind = 'image' | 'video' | 'stt' | 'tts' | 'search'
export interface SelfHostCfg {
  image?: { enabled?: boolean; baseUrl?: string; path?: string; width?: number; height?: number }   // img_server: POST /generate {prompt,neg,width,height} → PNG
  video?: { enabled?: boolean; baseUrl?: string; path?: string }                                     // video_server: POST /i2v → MP4
  stt?: { enabled?: boolean; baseUrl?: string; model?: string }                                       // whisper (سازگار با OpenAI /v1/audio/transcriptions)
  tts?: { enabled?: boolean; baseUrl?: string; model?: string; voice?: string }                       // piper (سازگار با OpenAI /v1/audio/speech)
  search?: { enabled?: boolean; baseUrl?: string }                                                    // SearXNG: GET /search?q=&format=json
}

const trim = (u?: string) => String(u || '').replace(/\/+$/, '')
export function selfHost(): SelfHostCfg { return getAdminData().selfHost || {} }
function on<K extends SelfHostKind>(k: K): NonNullable<SelfHostCfg[K]> | null {
  const c = selfHost()[k] as any
  return c && c.enabled && c.baseUrl ? c : null
}
export const imageConfigured = () => !!on('image')
export const videoConfigured = () => !!on('video')
export const sttConfigured = () => !!on('stt')
export const ttsConfigured = () => !!on('tts')
export const searchConfigured = () => !!on('search')

const T = (ms: number) => AbortSignal.timeout(ms)
const mimeFromCT = (ct: string, fallback = 'image/png') =>
  ct.includes('png') ? 'image/png' : ct.includes('webp') ? 'image/webp' : ct.includes('jpeg') || ct.includes('jpg') ? 'image/jpeg'
  : ct.includes('mp4') ? 'video/mp4' : ct.includes('webm') ? 'video/webm'
  : ct.includes('mpeg') || ct.includes('mp3') ? 'audio/mpeg' : ct.includes('wav') ? 'audio/wav' : fallback

// ── تصویر (img_server) ── خروجی: URLِ محلیِ /api/media/<id>
export async function selfHostImage(prompt: string, opts: { neg?: string; width?: number; height?: number } = {}): Promise<string> {
  const c = on('image'); if (!c) throw new Error('سرورِ تصویرِ خودی تنظیم/روشن نیست')
  const url = trim(c.baseUrl) + (c.path || '/generate')
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, neg: opts.neg || '', width: opts.width || c.width || 1024, height: opts.height || c.height || 1024 }), signal: T(180000) })
  if (!r.ok) throw new Error(`سرورِ تصویر HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  const ct = r.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const d = await r.json().catch(() => ({} as any))
    const b64 = d.image || d.b64 || d.b64_json || (Array.isArray(d.images) ? d.images[0] : '') || (Array.isArray(d.data) ? (d.data[0]?.b64_json || d.data[0]) : '')
    if (b64 && typeof b64 === 'string') { const buf = Buffer.from(b64.replace(/^data:[^,]+,/, ''), 'base64'); return `/api/media/${saveMedia(buf, 'image/png', 'ai-img').id}` }
    if (d.url) return String(d.url)
    throw new Error('پاسخِ JSONِ تصویر، تصویری نداشت')
  }
  const buf = Buffer.from(await r.arrayBuffer())
  if (!buf.length) throw new Error('تصویرِ خالی برگشت')
  return `/api/media/${saveMedia(buf, mimeFromCT(ct, 'image/png'), 'ai-img').id}`
}

// ── ویدئو (video_server /i2v) ── ورودیِ عکس (data URL یا URLِ محلی) → MP4 → /api/media/<id>
export async function selfHostVideo(image: string, opts: { prompt?: string } = {}): Promise<string> {
  const c = on('video'); if (!c) throw new Error('سرورِ ویدئوِ خودی تنظیم/روشن نیست')
  const url = trim(c.baseUrl) + (c.path || '/i2v')
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image, prompt: opts.prompt || '' }), signal: T(300000) })
  if (!r.ok) throw new Error(`سرورِ ویدئو HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  const ct = r.headers.get('content-type') || ''
  if (ct.includes('application/json')) { const d = await r.json().catch(() => ({} as any)); if (d.url) return String(d.url); const b64 = d.video || d.b64; if (b64) return `/api/media/${saveMedia(Buffer.from(String(b64).replace(/^data:[^,]+,/, ''), 'base64'), 'video/mp4', 'ai-vid').id}`; throw new Error('پاسخِ JSONِ ویدئو، ویدئویی نداشت') }
  const buf = Buffer.from(await r.arrayBuffer()); if (!buf.length) throw new Error('ویدئوِ خالی')
  return `/api/media/${saveMedia(buf, mimeFromCT(ct, 'video/mp4'), 'ai-vid').id}`
}

// ── STT (whisper، سازگار با OpenAI) ── ورودی: صوت (Buffer) → متن
export async function selfHostTranscribe(audio: Buffer, filename = 'audio.webm'): Promise<string> {
  const c = on('stt'); if (!c) throw new Error('سرورِ تبدیلِ گفتار به متن تنظیم/روشن نیست')
  const url = trim(c.baseUrl) + '/v1/audio/transcriptions'
  const fd = new FormData()
  fd.append('file', new Blob([new Uint8Array(audio)]), filename)
  fd.append('model', c.model || 'whisper-1')
  const r = await fetch(url, { method: 'POST', body: fd, signal: T(120000) })
  if (!r.ok) throw new Error(`سرورِ STT HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  const d = await r.json().catch(() => ({} as any))
  return String(d.text || d.transcription || '').trim()
}

// ── TTS (piper، سازگار با OpenAI /v1/audio/speech) ── ورودی: متن → URLِ صوتیِ محلی
export async function selfHostSpeak(text: string): Promise<string> {
  const c = on('tts'); if (!c) throw new Error('سرورِ تبدیلِ متن به گفتار تنظیم/روشن نیست')
  const url = trim(c.baseUrl) + '/v1/audio/speech'
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: c.model || 'tts-1', input: text.slice(0, 4000), voice: c.voice || 'fa' }), signal: T(120000) })
  if (!r.ok) throw new Error(`سرورِ TTS HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  const ct = r.headers.get('content-type') || ''
  const buf = Buffer.from(await r.arrayBuffer()); if (!buf.length) throw new Error('صوتِ خالی')
  return `/api/media/${saveMedia(buf, mimeFromCT(ct, 'audio/mpeg'), 'ai-tts').id}`
}

// ── جستجوی وب (SearXNG) ── خروجی: چند نتیجهٔ {title,url,content}
export interface WebResult { title: string; url: string; content: string }
export async function selfHostSearch(query: string, max = 6): Promise<WebResult[]> {
  const c = on('search'); if (!c) throw new Error('سرورِ جستجوی وب تنظیم/روشن نیست')
  const url = trim(c.baseUrl) + '/search?format=json&q=' + encodeURIComponent(query)
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: T(30000) })
  if (!r.ok) throw new Error(`سرورِ جستجو HTTP ${r.status}`)
  const d = await r.json().catch(() => ({} as any))
  const rows: any[] = Array.isArray(d.results) ? d.results : []
  return rows.slice(0, max).map(x => ({ title: String(x.title || ''), url: String(x.url || ''), content: String(x.content || x.snippet || '').slice(0, 400) })).filter(x => x.url)
}
