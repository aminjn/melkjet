import { NextRequest, NextResponse } from 'next/server'
import { requireAndBumpUsage } from '@/app/lib/plan-usage'
import { getSession } from '@/app/lib/session'
import { getAdminData } from '@/app/lib/admin-store'
import { sendMail } from '@/app/lib/smtp'
import { chargeSend } from '@/app/lib/comm-store'

// ارسال کمپین/ایمیل انبوه از طریق SMTP تنظیم‌شده در پنل.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای ارسال ایمیل باید وارد شوید' }, { status: 401 })

  const b = await req.json().catch(() => ({}))
  const subject = String(b.subject || '').trim()
  const bodyHtml = String(b.body || b.html || '').trim()
  const raw: string[] = Array.isArray(b.recipients) ? b.recipients : String(b.recipients || '').split(/[\s,;]+/)
  const recipients = Array.from(new Set(raw.map(x => x.trim()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))))

  if (!subject) return NextResponse.json({ error: 'موضوع ایمیل خالی است' }, { status: 400 })
  if (!bodyHtml) return NextResponse.json({ error: 'متن ایمیل خالی است' }, { status: 400 })
  if (!recipients.length) return NextResponse.json({ error: 'ایمیل معتبری وارد نشده' }, { status: 400 })
  { const u52 = await requireAndBumpUsage(s as any, 'email', recipients.length); if (u52) return NextResponse.json(u52, { status: 403 }) }   // فاز ۵۲: سهمیهٔ ماهانهٔ پلن
  if (recipients.length > 500) return NextResponse.json({ error: 'حداکثر ۵۰۰ گیرنده در هر ارسال' }, { status: 400 })

  const cfg = getAdminData().smtp
  if (!cfg?.host || !cfg?.user || !cfg?.pass) {
    return NextResponse.json({ error: 'سرویس ایمیل تنظیم نشده — در پنل سوپرادمین تنظیمات SMTP را وارد کنید.' }, { status: 400 })
  }

  // کسرِ اعتبارِ ایمیل (اگر سیستمِ پکیج روشن باشد؛ سوپرادمین معاف)
  const gate = await chargeSend(s.phone, s.role, 'email', recipients.length)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 200 })

  // متن ساده را به HTML سادهٔ راست‌چین تبدیل کن
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:1.9;color:#222">${bodyHtml.replace(/\n/g, '<br>')}</div>`

  try {
    const sent = await sendMail(cfg, recipients, subject, html)
    if (!sent) return NextResponse.json({ error: 'هیچ ایمیلی ارسال نشد (تنظیمات/احراز هویت را بررسی کنید)' }, { status: 200 })
    return NextResponse.json({ ok: true, sent })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در ارسال ایمیل' }, { status: 200 })
  }
}
