import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getLead, addActivity } from '@/app/lib/leads-store'
import { sendServiceSms } from '@/app/lib/sms'
import { sendMail } from '@/app/lib/smtp'
import { getAdminData } from '@/app/lib/admin-store'

// Communication Hub — پیامک/ایمیل/واتساپ/ثبتِ تماس؛ هر ارسال یک فعالیت در تایم‌لاینِ لید ثبت می‌کند.
// POST { leadId, channel:'sms'|'email'|'whatsapp'|'call', text?, subject?, to? }
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const lead = await getLead(s.phone, String(b.leadId || ''))
  if (!lead) return NextResponse.json({ error: 'لید یافت نشد' }, { status: 404 })
  const channel = String(b.channel || '')
  const text = String(b.text || '').trim()

  if (channel === 'sms') {
    const to = String(b.to || lead.phone || '').trim()
    if (!to) return NextResponse.json({ error: 'شمارهٔ لید موجود نیست' }, { status: 400 })
    if (!text) return NextResponse.json({ error: 'متنِ پیامک الزامی است' }, { status: 400 })
    const r = await sendServiceSms(to, text, 'پیام مشاور')
    await addActivity(s.phone, lead.id, { type: 'sms', note: r.ok ? `پیامک: ${text.slice(0, 80)}` : `پیامک ناموفق: ${r.error || ''}`, meta: { to, ok: r.ok } })
    return NextResponse.json({ ok: r.ok, error: r.error })
  }

  if (channel === 'email') {
    const to = String(b.to || '').trim()
    if (!to) return NextResponse.json({ error: 'ایمیلِ گیرنده الزامی است' }, { status: 400 })
    const smtp = getAdminData().smtp
    if (!smtp?.host) return NextResponse.json({ error: 'SMTP در ادمین تنظیم نشده' }, { status: 400 })
    try {
      const n = await sendMail(smtp as any, [to], String(b.subject || 'پیام از مشاور'), `<div dir="rtl">${text.replace(/\n/g, '<br>')}</div>`)
      await addActivity(s.phone, lead.id, { type: 'email', note: `ایمیل به ${to}: ${String(b.subject || '').slice(0, 60)}`, meta: { to, sent: n } })
      return NextResponse.json({ ok: n > 0 })
    } catch (e: any) {
      await addActivity(s.phone, lead.id, { type: 'email', note: `ایمیل ناموفق: ${e?.message || ''}`, meta: { to, ok: false } })
      return NextResponse.json({ ok: false, error: e?.message || 'خطا در ارسال' })
    }
  }

  if (channel === 'whatsapp') {
    const to = String(b.to || lead.phone || '').replace(/\D/g, '').replace(/^0/, '98')
    const link = to ? `https://wa.me/${to}?text=${encodeURIComponent(text)}` : ''
    await addActivity(s.phone, lead.id, { type: 'whatsapp', note: `واتساپ: ${text.slice(0, 80)}`, meta: { to } })
    return NextResponse.json({ ok: true, link })
  }

  if (channel === 'call') {
    await addActivity(s.phone, lead.id, { type: 'call', note: text || 'تماسِ تلفنی', meta: { outcome: b.outcome } })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'کانالِ نامعتبر' }, { status: 400 })
}
