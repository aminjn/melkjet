import { NextRequest, NextResponse } from 'next/server'
import { generateOTP, setOTP } from '@/app/lib/otp-store'

export async function POST(req: NextRequest) {
  const { phone } = await req.json()

  if (!phone || !/^09[0-9]{9}$/.test(phone)) {
    return NextResponse.json({ error: 'شماره موبایل معتبر نیست' }, { status: 400 })
  }

  const code = generateOTP()
  setOTP(phone, code)

  const apiKey = process.env.IPPANEL_API_KEY
  const sender = process.env.IPPANEL_SENDER
  const pattern = process.env.IPPANEL_PATTERN

  if (!apiKey || !sender || !pattern) {
    // Dev mode — OTP printed to server console
    console.log(`[DEV OTP] ${phone} → ${code}`)
    return NextResponse.json({ ok: true, dev: true })
  }

  try {
    const res = await fetch('https://api2.ippanel.com/api/v1/messages/send-pattern', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      body: JSON.stringify({
        pattern_code: pattern,
        originator: sender,
        recipient: phone,
        values: { code },
      }),
    })
    if (!res.ok) {
      console.error('IPPanel error:', await res.text())
      return NextResponse.json({ error: 'خطا در ارسال پیامک' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('IPPanel fetch error:', e)
    return NextResponse.json({ error: 'خطا در اتصال به سرور پیامک' }, { status: 500 })
  }
}
