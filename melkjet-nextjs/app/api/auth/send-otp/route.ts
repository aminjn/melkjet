import { NextRequest, NextResponse } from 'next/server'
import { generateOTP, setOTP } from '@/app/lib/otp-store'
import { getAdminData } from '@/app/lib/admin-store'
import { shecanRequest } from '@/app/lib/shecan-https'

export async function POST(req: NextRequest) {
  const { phone } = await req.json()

  if (!phone || !/^09[0-9]{9}$/.test(phone)) {
    return NextResponse.json({ error: 'شماره موبایل معتبر نیست' }, { status: 400 })
  }

  const code = generateOTP()
  setOTP(phone, code)

  const apiKey = process.env.IPPANEL_API_KEY || getAdminData().ippanel?.apiKey
  const sender = process.env.IPPANEL_SENDER || getAdminData().ippanel?.sender
  const pattern = process.env.IPPANEL_PATTERN || getAdminData().ippanel?.pattern
  const patternVar = (getAdminData().ippanel?.patternVar || 'code').trim() || 'code'

  if (!apiKey || !sender || !pattern) {
    // پیامک هنوز پیکربندی نشده → کد را برمی‌گردانیم تا کاربر بتواند وارد شود و تست کند.
    // به‌محض تنظیم IPPanel در پنل مدیریت، این کد دیگر برگردانده نمی‌شود.
    console.log(`[DEV OTP] ${phone} → ${code}`)
    return NextResponse.json({ ok: true, dev: true, code })
  }

  try {
    // فرمت رسمی IPPanel برای ارسال پترن (OTP): sms/pattern/normal/send
    //   body: { code: <pattern_code>, sender, recipient, variable: { code: <otp> } }
    const res = await shecanRequest('https://api2.ippanel.com/api/v1/sms/pattern/normal/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey, accept: 'application/json' },
      body: JSON.stringify({ code: pattern, sender, recipient: phone, variable: { [patternVar]: code } }),
      timeout: 15000,
    })
    let parsed: any = null
    try { parsed = JSON.parse(res.body) } catch {}
    const okStatus = res.status >= 200 && res.status < 300
    const metaOk = parsed?.meta?.status !== false && !/"status"\s*:\s*"?error"?/i.test(res.body)
    if (!okStatus || !metaOk) {
      const detail = parsed?.meta?.message || parsed?.error_message || parsed?.message || res.body.slice(0, 240) || `HTTP ${res.status}`
      console.error('IPPanel OTP error:', res.status, res.body.slice(0, 300))
      return NextResponse.json({ error: `سرویس پیامک: ${detail}` }, { status: 200 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: `اتصال به سرویس پیامک ناموفق: ${e?.message || 'خطا'}` }, { status: 200 })
  }
}

