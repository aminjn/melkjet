import { getAdminData } from './admin-store'
import { shecanRequest } from './shecan-https'

// ارسالِ پیامکِ خدماتی/اطلاع‌رسانی با IPPanel — مشترک بینِ اتوماسیون و سایر کانال‌ها.
// پترنِ عمومیِ %message% را از تنظیماتِ «هشدارها» می‌گیرد (همان پترنِ اطلاع‌رسانی)؛
// اگر پترن تنظیم نشده باشد، پیام را به‌صورتِ متنِ آزاد (bulk) می‌فرستد.
export async function sendServiceSms(phone: string, text: string, summary = 'اتوماسیون ملک‌جت'): Promise<{ ok: boolean; error?: string }> {
  const a = getAdminData()
  const apiKey = process.env.IPPANEL_API_KEY || a.ippanel?.apiKey
  const sender = process.env.IPPANEL_SENDER || a.ippanel?.sender
  if (!apiKey || !sender) return { ok: false, error: 'پیامک پیکربندی نشده' }
  const recipient = String(phone).replace(/\D/g, '')
  if (!/^09\d{9}$/.test(recipient)) return { ok: false, error: 'شمارهٔ نامعتبر' }
  const patternCode = (a.alerts?.pattern || '').trim()      // پترنِ عمومیِ اطلاع‌رسانی (متغیرِ message)
  const patternVar = (a.alerts?.patternVar || 'message').trim() || 'message'
  try {
    let url: string, body: any
    if (patternCode) {
      url = 'https://api2.ippanel.com/api/v1/sms/pattern/normal/send'
      body = { code: patternCode, sender, recipient, variable: { [patternVar]: text } }
    } else {
      url = 'https://api2.ippanel.com/api/v1/sms/send/webservice/single'
      body = { sender, recipient: [recipient], message: text, description: { summary, count_recipient: '1' } }
    }
    const res = await shecanRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey, accept: 'application/json' }, body: JSON.stringify(body), timeout: 20000 })
    const ok = res.status >= 200 && res.status < 300
    return ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` }
  } catch (e: any) { return { ok: false, error: e?.message || 'خطا' } }
}
