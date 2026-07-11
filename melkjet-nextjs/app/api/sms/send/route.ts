import { NextRequest, NextResponse } from 'next/server'
import { requireAndBumpUsage } from '@/app/lib/plan-usage'
import { getSession } from '@/app/lib/session'
import { getAdminData } from '@/app/lib/admin-store'
import { shecanRequest } from '@/app/lib/shecan-https'
import { chargeSend } from '@/app/lib/comm-store'

// ارسال پیامک انبوه بازاریابی از طریق سرویس داخلی IPPanel.
// فرمت رسمی IPPanel: POST https://api2.ippanel.com/api/v1/sms/send/webservice/single
//   header: apikey   body: { sender, recipient:[...], message, description:{summary,count_recipient} }
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای ارسال پیامک باید وارد شوید' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const text = String(b.message || '').trim()
  const raw: string[] = Array.isArray(b.recipients) ? b.recipients : String(b.recipients || '').split(/[\s,;]+/)
  const recipients = Array.from(new Set(raw.map(x => x.replace(/\D/g, '')).filter(x => /^09\d{9}$/.test(x))))

  if (!text) return NextResponse.json({ error: 'متن پیامک خالی است' }, { status: 400 })
  if (!recipients.length) return NextResponse.json({ error: 'شماره موبایل معتبری وارد نشده (قالب: 09xxxxxxxxx)' }, { status: 400 })
  if (recipients.length > 500) return NextResponse.json({ error: 'حداکثر ۵۰۰ شماره در هر ارسال' }, { status: 400 })

  const apiKey = process.env.IPPANEL_API_KEY || getAdminData().ippanel?.apiKey
  const sender = process.env.IPPANEL_SENDER || getAdminData().ippanel?.sender
  if (!apiKey || !sender) {
    return NextResponse.json({ error: 'سرویس پیامک تنظیم نشده — در پنل سوپرادمین کلید و خط IPPanel را وارد کنید.' }, { status: 400 })
  }

  { const u52 = await requireAndBumpUsage(s as any, 'sms', recipients.length); if (u52) return NextResponse.json(u52, { status: 403 }) }   // فاز ۵۲: سهمیهٔ ماهانهٔ پلن
  // کسرِ اعتبارِ پیامک (اگر سیستمِ پکیج روشن باشد؛ سوپرادمین معاف)
  const gate = await chargeSend(s.phone, s.role, 'sms', recipients.length)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 200 })

  // لینک‌های داخلِ متن را کوتاه و ردگیری کن (انبوه = آمارِ تجمیعی، بدون شمارهٔ خاص)
  const { shortenLinksInText } = await import('@/app/lib/shortener')
  const message = await shortenLinksInText(text, { channel: 'campaign' })

  try {
    const res = await shecanRequest('https://api2.ippanel.com/api/v1/sms/send/webservice/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey, accept: 'application/json' },
      body: JSON.stringify({
        sender,
        recipient: recipients,
        message,
        description: { summary: 'کمپین ملک‌جت', count_recipient: String(recipients.length) },
      }),
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
    return NextResponse.json({ ok: true, sent: recipients.length, trackId: parsed?.data?.message_id || parsed?.data?.bulk_id })
  } catch (e: any) {
    return NextResponse.json({ error: `اتصال به سرویس پیامک ناموفق: ${e?.message || 'خطا'}` }, { status: 200 })
  }
}
