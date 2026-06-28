import { getAdminData } from './admin-store'
import { shecanRequest } from './shecan-https'
import { shortenLinksInText } from './shortener'

// ارسالِ پیامکِ متنِ آزاد با IPPanel — برای اتوماسیون/پیام‌های دلخواه.
// چون متنِ دلخواه نمی‌تواند پترنِ ثابتِ تأییدشده باشد، با endpointِ متنِ آزاد (bulk) فرستاده
// می‌شود؛ پس برای کارکرد به «خطِ تبلیغاتی» (یا خطی با مجوزِ متنِ آزاد) نیاز است. اگر ادمین
// یک «پترنِ اتوماسیون» با متغیرِ آزاد ثبت کرده باشد، از آن استفاده می‌شود.
// text: متنِ کامل (برای خطِ تبلیغاتی/bulk). varValue: مقدارِ کوتاهِ متغیرِ پترنِ اتوماسیون
// (مثلاً نامِ گیرنده) برای خطِ خدماتی. اگر automationPattern تنظیم باشد، پترن استفاده می‌شود.
export async function sendServiceSms(phone: string, text: string, summary = 'اتوماسیون ملک‌جت', varValue?: string): Promise<{ ok: boolean; error?: string }> {
  const a = getAdminData()
  const apiKey = process.env.IPPANEL_API_KEY || a.ippanel?.apiKey
  const sender = process.env.IPPANEL_SENDER || a.ippanel?.sender
  if (!apiKey || !sender) return { ok: false, error: 'پیامک پیکربندی نشده' }
  const recipient = String(phone).replace(/\D/g, '')
  if (!/^09\d{9}$/.test(recipient)) return { ok: false, error: 'شمارهٔ نامعتبر' }
  // لینک‌های داخلِ متن را کوتاه و ردگیری کن (برای حالتِ متنِ آزاد/bulk)
  text = await shortenLinksInText(text, { channel: 'automation', phone: recipient })
  // پترنِ اختیاریِ اتوماسیون (خطِ خدماتی) — متغیرِ کوچک؛ خالی = متنِ آزادِ bulk (خطِ تبلیغاتی)
  const patternCode = (a.ippanel?.automationPattern || '').trim()
  const patternVar = (a.ippanel?.automationVar || 'name').trim() || 'name'
  try {
    let url: string, body: any
    if (patternCode) {
      url = 'https://api2.ippanel.com/api/v1/sms/pattern/normal/send'
      body = { code: patternCode, sender, recipient, variable: { [patternVar]: (varValue || text).slice(0, 60) } }
    } else {
      url = 'https://api2.ippanel.com/api/v1/sms/send/webservice/single'
      body = { sender, recipient: [recipient], message: text, description: { summary, count_recipient: '1' } }
    }
    const res = await shecanRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey, accept: 'application/json' }, body: JSON.stringify(body), timeout: 20000 })
    const ok = res.status >= 200 && res.status < 300
    return ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` }
  } catch (e: any) { return { ok: false, error: e?.message || 'خطا' } }
}
