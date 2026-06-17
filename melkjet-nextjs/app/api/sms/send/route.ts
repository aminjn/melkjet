import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData } from '@/app/lib/admin-store'
import { shecanRequest } from '@/app/lib/shecan-https'

// ارسال پیامک انبوه بازاریابی از طریق سرویس داخلی IPPanel.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای ارسال پیامک باید وارد شوید' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const text = String(b.message || '').trim()
  // شماره‌ها: آرایه یا رشتهٔ جداشده با کاما/فاصله/خط جدید
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

  try {
    const res = await shecanRequest('https://api2.ippanel.com/api/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ originator: sender, recipients, message: text }),
      timeout: 20000,
    })
    if (res.status < 200 || res.status >= 300) {
      return NextResponse.json({ error: `خطای سرویس پیامک (${res.status})`, detail: res.body.slice(0, 200) }, { status: 200 })
    }
    return NextResponse.json({ ok: true, sent: recipients.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در اتصال به سرویس پیامک' }, { status: 200 })
  }
}
