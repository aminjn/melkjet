import { generateOTP, setOTP } from './otp-store'
import { getAdminData } from './admin-store'
import { shecanRequest } from './shecan-https'

// ارسالِ کدِ OTP با IPPanel (پترن). اگر پیامک پیکربندی نشده باشد، کد را برای حالتِ توسعه برمی‌گرداند.
export async function sendOtpSms(phone: string): Promise<{ ok: boolean; dev?: boolean; code?: string; error?: string }> {
  const code = generateOTP()
  setOTP(phone, code)
  const a = getAdminData()
  const apiKey = process.env.IPPANEL_API_KEY || a.ippanel?.apiKey
  const sender = process.env.IPPANEL_SENDER || a.ippanel?.sender
  const pattern = process.env.IPPANEL_PATTERN || a.ippanel?.pattern
  const patternVar = (a.ippanel?.patternVar || 'code').trim() || 'code'
  if (!apiKey || !sender || !pattern) { console.log(`[DEV OTP] ${phone} → ${code}`); return { ok: true, dev: true, code } }
  try {
    const res = await shecanRequest('https://api2.ippanel.com/api/v1/sms/pattern/normal/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey, accept: 'application/json' },
      body: JSON.stringify({ code: pattern, sender, recipient: phone, variable: { [patternVar]: code } }),
      timeout: 15000,
    })
    let parsed: any = null; try { parsed = JSON.parse(res.body) } catch {}
    const okStatus = res.status >= 200 && res.status < 300
    const metaOk = parsed?.meta?.status !== false && !/"status"\s*:\s*"?error"?/i.test(res.body)
    if (!okStatus || !metaOk) {
      const detail = parsed?.meta?.message || parsed?.error_message || parsed?.message || res.body.slice(0, 240) || `HTTP ${res.status}`
      return { ok: false, error: `سرویس پیامک: ${detail}` }
    }
    return { ok: true }
  } catch (e: any) { return { ok: false, error: `اتصال به سرویس پیامک ناموفق: ${e?.message || 'خطا'}` } }
}
