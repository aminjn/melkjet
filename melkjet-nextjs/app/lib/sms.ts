import { getAdminData } from './admin-store'
import { shecanRequest } from './shecan-https'
import { shortenLinksInText, linkVarName, firstUrl, siteBase } from './shortener'
import { FA_DIGITS, faDigit } from '../lib/digits'

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
  const recipient = String(phone).replace(FA_DIGITS, faDigit).replace(/\D/g, '')
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
      const variable: any = { [patternVar]: (varValue || text).slice(0, 60) }
      // اگر متغیرِ لینک تنظیم شده باشد، لینکِ کوتاه (از داخلِ متن یا آدرسِ سایت) را هم بفرست
      const lv = linkVarName()
      if (lv) variable[lv] = firstUrl(text) || siteBase()
      body = { code: patternCode, sender, recipient, variable }
    } else {
      url = 'https://api2.ippanel.com/api/v1/sms/send/webservice/single'
      body = { sender, recipient: [recipient], message: text, description: { summary, count_recipient: '1' } }
    }
    const res = await shecanRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey, accept: 'application/json' }, body: JSON.stringify(body), timeout: 20000 })
    const ok = res.status >= 200 && res.status < 300
    return ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` }
  } catch (e: any) { return { ok: false, error: e?.message || 'خطا' } }
}

// ─── فاز ۲۹۷ب — پیامکِ سایت‌ساز: پترنِ «اختصاصیِ» خودش ───────────────────────────
// سایت‌ساز نباید پترنِ عمومیِ اتوماسیون (با متنِ «کارشناس تماس می‌گیرد») را بدزدد؛
// متنِ پیامکِ پترنی از خودِ پترنِ ثبت‌شده می‌آید، پس هر کارکرد پترنِ خودش را می‌خواهد.
// اولویت: autositePattern؛ نبود → متنِ آزادِ bulk (فقط خطِ تبلیغاتی).
export async function sendAutoSiteSms(phone: string, name: string, url: string): Promise<{ ok: boolean; error?: string }> {
  const a = getAdminData()
  const apiKey = process.env.IPPANEL_API_KEY || a.ippanel?.apiKey
  const sender = process.env.IPPANEL_SENDER || a.ippanel?.sender
  if (!apiKey || !sender) return { ok: false, error: 'پیامک پیکربندی نشده' }
  const recipient = String(phone).replace(FA_DIGITS, faDigit).replace(/\D/g, '')
  if (!/^09\d{9}$/.test(recipient)) return { ok: false, error: 'شمارهٔ نامعتبر' }
  const patternCode = (a.ippanel?.autositePattern || '').trim()
  const nameVar = (a.ippanel?.autositeVar || 'name').trim() || 'name'
  try {
    if (patternCode) {
      // لینک کوتاه/ردگیری می‌شود و در متغیرِ لینکِ پترن می‌نشیند (همان سازوکارِ بقیهٔ پترن‌ها).
      const short = await shortenLinksInText(url, { channel: 'autosite', phone: recipient })
      const variable: Record<string, string> = { [nameVar]: String(name || 'همکار').slice(0, 60) }
      const lv = linkVarName()
      if (lv) variable[lv] = firstUrl(short) || short || siteBase()
      const body = { code: patternCode, sender, recipient, variable }
      const res = await shecanRequest('https://api2.ippanel.com/api/v1/sms/pattern/normal/send', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey, accept: 'application/json' }, body: JSON.stringify(body), timeout: 20000 })
      const ok = res.status >= 200 && res.status < 300
      // فاز ۲۹۷ن — پاسخِ IPPanel علتِ دقیق را می‌گوید (پترن تایید نشده/متغیر غلط/…) — دور نریز.
      return ok ? { ok: true } : { ok: false, error: `HTTP ${res.status} (پترن سایت‌ساز): ${String(res.body || '').slice(0, 160)}` }
    }
    // بدونِ پترنِ اختصاصی → متنِ آزاد (خطِ تبلیغاتی لازم دارد؛ خطِ خدماتی رد می‌کند)
    return sendServiceSms(recipient, `سلام ${name} عزیز؛ سایت اختصاصی شما در ملک‌جت آماده شد:\n${url}\nملک‌جت`, 'سایت‌ساز ملک‌جت', name)
  } catch (e: any) { return { ok: false, error: e?.message || 'خطا' } }
}
