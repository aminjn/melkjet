// فاز ۲۵۲ / ۳۰۰ — ترنسپورتِ رباتِ چندسکویی (تلگرام + بله). «سکوی جاری» از bot-ctx (AsyncLocalStorage)
// می‌آید؛ اگر ست نشده باشد، پیش‌فرض تلگرام است — پس همهٔ مصرف‌کننده‌های قبلی بی‌تغییر کار می‌کنند.
// تلگرام از ایران فیلتر است → از پروکسی (اول v2ray) رد می‌شود؛ بله داخلی است → مستقیم.
import { proxiedRequest, proxiedGetBinary } from './proxy-fetch'
import { currentBot, tgBotCtx, type BotCtx } from './bot-ctx'

const ctx = (): BotCtx => currentBot() || tgBotCtx()

export const tgConfigured = () => !!tgBotCtx().token

// فاز ۳۰۰ب — بله parse_mode:'HTML' را رندر نمی‌کند و تگِ <b>…</b> را خام نشان می‌دهد.
// پس برای بله تگ‌ها را پاک می‌کنیم و parse_mode را برمی‌داریم (متنِ تمیزِ ساده).
function stripHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}
function sanitizeForBale(params: Record<string, unknown>): Record<string, unknown> {
  const p = { ...params }
  if ('parse_mode' in p) delete p.parse_mode
  if (typeof p.text === 'string') p.text = stripHtml(p.text)
  if (typeof p.caption === 'string') p.caption = stripHtml(p.caption)
  return p
}

/** تماسِ خامِ Bot API از راهِ سکوی جاری. در خطا null برمی‌گرداند (نه throw). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function tgApi<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T | null> {
  const c = ctx()
  if (!c.token) { console.warn(`[${c.platform}] توکنِ ربات تنظیم نشده`); return null }
  const payload = c.platform === 'bale' ? sanitizeForBale(params) : params
  try {
    const r = await proxiedRequest(`${c.apiBase}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
      proxyUrl: c.proxy || undefined,
      timeout: 20000,
    })
    const j = JSON.parse(r.body || '{}')
    if (!j.ok) { console.warn(`[${c.platform}]`, method, 'failed:', j.description || r.status); return null }
    return j.result as T
  } catch (e) {
    console.warn(`[${c.platform}]`, method, 'error:', (e as Error).message || String(e), '| proxy:', c.proxy || '(direct)')
    return null
  }
}

/** ارسالِ پیام (HTML). */
export async function tgSend(chatId: number | string, text: string, extra: Record<string, unknown> = {}) {
  return tgApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra })
}

export function tgGetMe() { return tgApi('getMe') }

/** دانلودِ عکس/فایل (file_id) به‌صورتِ Buffer، از راهِ همان سکو. null در خطا. */
export async function tgFileBuffer(fileId: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const c = ctx(); if (!c.token) return null
  const f = await tgApi<{ file_path?: string }>('getFile', { file_id: fileId })
  if (!f?.file_path) return null
  try {
    const r = await proxiedGetBinary(`${c.fileBase}/${f.file_path}`, { proxyUrl: c.proxy || undefined, timeout: 25000 })
    if (r.status !== 200 || !r.buffer.length) return null
    const ext = (f.file_path.split('.').pop() || '').toLowerCase()
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    return { buffer: r.buffer, mime }
  } catch { return null }
}

/** ثبتِ وب‌هوک روی آدرسِ داده‌شده (با secretِ اختیاری). روی سکوی جاری اعمال می‌شود. */
export function tgSetWebhook(url: string, secret?: string) {
  return tgApi('setWebhook', {
    url,
    secret_token: secret || undefined,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  })
}
