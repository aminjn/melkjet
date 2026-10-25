// فاز ۳۲۶ — سرویس‌های هوش مصنوعیِ «خودِ مالک» روی سرورِ GPU (از طریقِ تونلِ محلی).
// همه opt-in و قابلِ تنظیم از سوپرادمین؛ تا وقتی baseUrl ندهی و روشن نکنی، رفتارِ فعلی عوض نمی‌شود.
// endpointها http://127.0.0.1:<port> هستند (تونلِ SSH) — gapHttp/shecan دخالت نمی‌کند، مستقیم fetch.
import { saveMedia } from './media-store'
import { getAdminData } from './admin-store'

export type SelfHostKind = 'image' | 'video' | 'stt' | 'tts' | 'search'
// apiKey (اختیاری): اگر سرویس‌ها پشتِ «دروازهٔ رسانه» باشند، کلید در هدرِ X-Media-Key می‌رود.
export interface SelfHostCfg {
  image?: { enabled?: boolean; baseUrl?: string; path?: string; width?: number; height?: number; steps?: number; timeoutSec?: number; apiKey?: string }   // دروازه: POST /img/generate {prompt,negative,ratio,steps} → PNG
  video?: { enabled?: boolean; baseUrl?: string; path?: string; apiKey?: string }                      // دروازه: POST /vid/i2v (multipart: file,prompt,quality,steps) → MP4
  stt?: { enabled?: boolean; baseUrl?: string; model?: string; apiKey?: string }                        // whisper (سازگار با OpenAI /v1/audio/transcriptions)
  tts?: { enabled?: boolean; baseUrl?: string; model?: string; voice?: string; apiKey?: string }        // piper (سازگار با OpenAI /v1/audio/speech)
  search?: { enabled?: boolean; baseUrl?: string; apiKey?: string }                                     // SearXNG: GET /search?q=&format=json
}

const trim = (u?: string) => String(u || '').replace(/\/+$/, '')
// هدرِ احرازِ دروازهٔ رسانه (اگر کلید تنظیم شده باشد). دروازه با 401 جواب می‌دهد اگر کلید نباشد/غلط باشد.
const keyHdr = (c: any): Record<string, string> => (c && c.apiKey ? { 'X-Media-Key': String(c.apiKey) } : {})
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

// نسبتِ ابعاد از عرض/ارتفاع (قراردادِ img_serverِ Qwen-Image که به‌جای width/height، ratio می‌گیرد).
function ratioFromWH(w: number, h: number): string {
  const r = w / h
  const table: [string, number][] = [['1:1', 1], ['16:9', 16 / 9], ['9:16', 9 / 16], ['4:3', 4 / 3], ['3:4', 3 / 4], ['3:2', 3 / 2]]
  let best = '1:1', bd = Infinity
  for (const [name, val] of table) { const d = Math.abs(r - val); if (d < bd) { bd = d; best = name } }
  return best
}

// ── تصویر (img_server، Qwen-Image) ── خروجی: URLِ محلیِ /api/media/<id>
// سرورِ واقعیِ مالک (`/root/img_server.py`): POST /generate با {prompt, negative, ratio, steps, cfg}
// و خروجیِ PNGِ خام. فیلدهای width/height/neg را هم می‌فرستیم تا با سرورهای دیگر هم سازگار بماند
// (FastAPI فیلدهای اضافه را نادیده می‌گیرد).
export async function selfHostImage(prompt: string, opts: { neg?: string; width?: number; height?: number; steps?: number } = {}): Promise<string> {
  const c = on('image'); if (!c) throw new Error('سرورِ تصویرِ خودی تنظیم/روشن نیست')
  const url = trim(c.baseUrl) + (c.path || '/img/generate')
  const w = opts.width || c.width || 1024, h = opts.height || c.height || 1024
  const neg = opts.neg || ' '
  // steps پیش‌فرضِ سرور ۳۰ است؛ ۲۰ می‌فرستیم (طبقِ سندِ دروازه ~۴۶ث روی ۱۳۲۸). مهلت بلند چون
  // بارِ اولِ بعد از بیکاری، ~۲۵ث بارگذاریِ مدل هم اضافه می‌شود.
  const steps = opts.steps || c.steps || 20
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...keyHdr(c) },
    body: JSON.stringify({ prompt, negative: neg, neg, ratio: ratioFromWH(w, h), width: w, height: h, steps }),
    signal: T((c.timeoutSec || 600) * 1000) })
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

// data URL یا base64ِ خام → Buffer (برای آپلودِ multipart).
function imageToBuffer(image: string): Buffer {
  return Buffer.from(String(image).replace(/^data:[^,]+,/, ''), 'base64')
}

// ── ویدئو (video_server /i2v، Wan) ── ورودیِ عکس → MP4 → /api/media/<id>
// سرورِ واقعیِ مالک (`/root/video_server.py`): POST /i2v به‌صورتِ multipart با فیلدِ `file` (عکس)
// + فیلدهای فرمِ prompt/quality/steps/frames/fps، و خروجیِ MP4ِ خام.
export async function selfHostVideo(image: string, opts: { prompt?: string; quality?: 'fast' | 'quality' } = {}): Promise<string> {
  const c = on('video'); if (!c) throw new Error('سرورِ ویدئوِ خودی تنظیم/روشن نیست')
  const url = trim(c.baseUrl) + (c.path || '/vid/i2v')
  const fd = new FormData()
  fd.append('file', new Blob([new Uint8Array(imageToBuffer(image))], { type: 'image/png' }), 'src.png')
  fd.append('prompt', opts.prompt || '')
  fd.append('quality', opts.quality || 'fast')
  fd.append('steps', '20')
  // ویدئو خیلی کندتر است (چند دقیقه)؛ دروازه تا ۱۸۰۰ث صبر می‌کند — مهلتِ کلاینت هم بلند.
  const r = await fetch(url, { method: 'POST', body: fd, headers: keyHdr(c), signal: T(1800000) })
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
  const r = await fetch(url, { method: 'POST', body: fd, headers: keyHdr(c), signal: T(120000) })
  if (!r.ok) throw new Error(`سرورِ STT HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  const d = await r.json().catch(() => ({} as any))
  return String(d.text || d.transcription || '').trim()
}

// ── TTS (piper، سازگار با OpenAI /v1/audio/speech) ── ورودی: متن → URLِ صوتیِ محلی
export async function selfHostSpeak(text: string): Promise<string> {
  const c = on('tts'); if (!c) throw new Error('سرورِ تبدیلِ متن به گفتار تنظیم/روشن نیست')
  const url = trim(c.baseUrl) + '/v1/audio/speech'
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...keyHdr(c) },
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
  const r = await fetch(url, { headers: { accept: 'application/json', ...keyHdr(c) }, signal: T(30000) })
  if (!r.ok) throw new Error(`سرورِ جستجو HTTP ${r.status}`)
  const d = await r.json().catch(() => ({} as any))
  const rows: any[] = Array.isArray(d.results) ? d.results : []
  return rows.slice(0, max).map(x => ({ title: String(x.title || ''), url: String(x.url || ''), content: String(x.content || x.snippet || '').slice(0, 400) })).filter(x => x.url)
}
