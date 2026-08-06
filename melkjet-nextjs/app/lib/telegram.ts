// فاز ۲۵۲ — یکپارچه‌سازیِ تلگرام (ربات). چون api.telegram.org از داخلِ ایران فیلتر است،
// همهٔ تماس‌ها از همان پروکسیِ سرور (proxyUrlِ کانفیگِ ادمین) و با proxiedRequest رد می‌شوند —
// دقیقاً همان مکانیزمی که divar/web-push استفاده می‌کنند. هیچ راهِ موازی‌ای ساخته نمی‌شود.
import { proxiedRequest } from './proxy-fetch'
import { getAdminData } from './admin-store'

const TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || ''
const PROXY = () =>
  getAdminData().divar?.proxyUrl ||
  process.env.HTTPS_PROXY || process.env.https_proxy ||
  process.env.HTTP_PROXY || process.env.http_proxy || undefined

export const tgConfigured = () => !!TOKEN()

/** تماسِ خامِ Bot API از راهِ پروکسی. در خطا null برمی‌گرداند (نه throw). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function tgApi<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T | null> {
  const token = TOKEN()
  if (!token) { console.warn('[tg] TELEGRAM_BOT_TOKEN تنظیم نشده'); return null }
  try {
    const r = await proxiedRequest(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(params),
      proxyUrl: PROXY(),
      timeout: 20000,
    })
    const j = JSON.parse(r.body || '{}')
    if (!j.ok) { console.warn('[tg]', method, 'failed:', j.description || r.status); return null }
    return j.result as T
  } catch (e) {
    console.warn('[tg]', method, 'error:', (e as Error).message)
    return null
  }
}

/** ارسالِ پیام (HTML). */
export async function tgSend(chatId: number | string, text: string, extra: Record<string, unknown> = {}) {
  return tgApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra })
}

export function tgGetMe() { return tgApi('getMe') }

/** ثبتِ وب‌هوک روی آدرسِ داده‌شده (با secretِ اختیاری). */
export function tgSetWebhook(url: string, secret?: string) {
  return tgApi('setWebhook', {
    url,
    secret_token: secret || undefined,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  })
}
