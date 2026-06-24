import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData } from '@/app/lib/admin-store'
import { shecanRequest } from '@/app/lib/shecan-https'
import { chargeSend } from '@/app/lib/comm-store'

// ارسالِ سریعِ پیامکِ مذاکره: اگر پترن تنظیم شده باشد از مسیرِ پترن (سریع/خدماتی) می‌رود،
// وگرنه از مسیرِ ارسالِ تکیِ معمولی. از اعتبارِ پیامکِ کاربر کم می‌شود (به‌جز سوپرادمین).
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای ارسال پیامک وارد شوید' }, { status: 401 })

  const b = await req.json().catch(() => ({} as any))
  const text = String(b.message || '').trim()
  const recipient = String(b.recipient || '').replace(/\D/g, '')
  if (!text) return NextResponse.json({ error: 'متنِ پیام خالی است' }, { status: 400 })
  if (!/^09\d{9}$/.test(recipient)) return NextResponse.json({ error: 'شمارهٔ موبایلِ معتبر وارد کنید (۰۹...)' }, { status: 400 })

  const admin = getAdminData()
  const apiKey = process.env.IPPANEL_API_KEY || admin.ippanel?.apiKey
  const sender = process.env.IPPANEL_SENDER || admin.ippanel?.sender
  if (!apiKey || !sender) return NextResponse.json({ error: 'سرویس پیامک تنظیم نشده — در پنل سوپرادمین کلید و خط IPPanel را وارد کنید.' }, { status: 400 })

  const gate = chargeSend(s.phone, s.role, 'sms', 1)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 200 })

  const patternCode = (admin.negotiation?.pattern || '').trim()
  const patternVar = (admin.negotiation?.patternVar || 'message').trim() || 'message'

  try {
    let url: string, body: any
    if (patternCode) {
      // مسیرِ پترن (ارسالِ سریعِ خدماتی)
      url = 'https://api2.ippanel.com/api/v1/sms/pattern/normal/send'
      body = { code: patternCode, sender, recipient, variable: { [patternVar]: text } }
    } else {
      url = 'https://api2.ippanel.com/api/v1/sms/send/webservice/single'
      body = { sender, recipient: [recipient], message: text, description: { summary: 'موتور مذاکره ملک‌جت', count_recipient: '1' } }
    }
    const res = await shecanRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey, accept: 'application/json' },
      body: JSON.stringify(body),
      timeout: 20000,
    })
    let parsed: any = null
    try { parsed = JSON.parse(res.body) } catch {}
    const okStatus = res.status >= 200 && res.status < 300
    const metaOk = parsed?.meta?.status !== false && !/"status"\s*:\s*"?error"?/i.test(res.body)
    if (!okStatus || !metaOk) {
      const detail = parsed?.meta?.message || parsed?.error_message || parsed?.message || res.body.slice(0, 240) || `HTTP ${res.status}`
      return NextResponse.json({ error: `سرویس پیامک: ${detail}`, status: res.status }, { status: 200 })
    }
    return NextResponse.json({ ok: true, via: patternCode ? 'pattern' : 'single', remaining: gate.remaining, trackId: parsed?.data?.message_id })
  } catch (e: any) {
    return NextResponse.json({ error: `اتصال به سرویس پیامک ناموفق: ${e?.message || 'خطا'}` }, { status: 200 })
  }
}
