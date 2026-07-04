import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData } from '@/app/lib/admin-store'
import { listAccounts } from '@/app/lib/account-store'
import { dashForRoleId } from '@/app/lib/role-store'
import { invitedSet, markInvited, invitedCount } from '@/app/lib/outreach-store'
import { shecanRequest } from '@/app/lib/shecan-https'
import { shortenLinksInText, linkVarName, trackAndShorten, siteBase } from '@/app/lib/shortener'
import { SUPER_ADMIN_PHONE } from '@/app/lib/session'

export const runtime = 'nodejs'
export const maxDuration = 300

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

// حساب‌های کسب‌وکاری‌ای که سوپرادمین ساخته (مشاور/آژانس/سازنده/…) با شمارهٔ معتبر.
// onlyNew=true → فقط آن‌هایی که هنوز وارد نشده‌اند (تازه برایشان پنل ساخته شده).
function targets(onlyNew = false) {
  return listAccounts()
    .filter(a => a.phone !== SUPER_ADMIN_PHONE && a.role)
    .filter(a => { const d = dashForRoleId(a.role); return d && d !== '/buyer' && d !== '/admin' })
    .filter(a => !onlyNew || !a.lastLogin)
    .map(a => ({ name: (a.name || 'همکار').trim(), phone: String(a.phone || '').replace(/\D/g, '') }))
    .filter(a => /^09\d{9}$/.test(a.phone))
}

// متنِ پیش‌فرضِ دعوت (برای حالتِ متنِ آزاد/bulk).
function inviteText(name: string): string {
  return `${name} گرامی، آگهی‌های شما رایگان و خودکار در ملک‌جت منتشر می‌شود! پنل اختصاصی، وب‌سایت‌ساز، CRM و دستیار هوش مصنوعی — همگی رایگان. همین حالا ثبت‌نام کنید: melkjet.com`
}

export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const onlyNew = new URL(req.url).searchParams.get('onlyNew') === '1'
  const all = targets(onlyNew)
  const inv = await invitedSet()
  const pending = all.filter(o => !inv.has(o.phone))
  return NextResponse.json({ totalOwners: all.length, invited: await invitedCount(), pending: pending.length, sample: pending.slice(0, 8).map(o => ({ name: o.name, phone: o.phone.replace(/(\d{4})\d{3}(\d{4})/, '$1***$2') })) })
}

// POST { limit } → به نخستین «limit» صاحبِ آگهیِ دعوت‌نشده پیامکِ دعوت می‌فرستد.
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const limit = Math.max(1, Math.min(500, Number(b.limit) || 50))
  const onlyNew = !!b.onlyNew
  const a = getAdminData()
  const apiKey = process.env.IPPANEL_API_KEY || a.ippanel?.apiKey
  const sender = process.env.IPPANEL_SENDER || a.ippanel?.sender
  if (!apiKey || !sender) return NextResponse.json({ error: 'سرویس پیامک تنظیم نشده' }, { status: 400 })
  const patternCode = (a.ippanel?.outreachPattern || '').trim()
  const patternVar = (a.ippanel?.outreachVar || 'name').trim() || 'name'

  const inv = await invitedSet()
  const pending = targets(onlyNew).filter(o => !inv.has(o.phone)).slice(0, limit)
  let sent = 0, failed = 0
  for (const o of pending) {
    try {
      let url: string, body: any
      if (patternCode) {
        const variable: any = { [patternVar]: o.name }
        const lv = linkVarName()
        if (lv) variable[lv] = await trackAndShorten(siteBase(), { channel: 'outreach', phone: o.phone, title: o.name })
        url = 'https://api2.ippanel.com/api/v1/sms/pattern/normal/send'; body = { code: patternCode, sender, recipient: o.phone, variable }
      }
      else { const msg = await shortenLinksInText(inviteText(o.name), { channel: 'outreach', phone: o.phone, title: o.name }); url = 'https://api2.ippanel.com/api/v1/sms/send/webservice/single'; body = { sender, recipient: [o.phone], message: msg, description: { summary: 'دعوت ملک‌جت', count_recipient: '1' } } }
      const res = await shecanRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey, accept: 'application/json' }, body: JSON.stringify(body), timeout: 20000 })
      if (res.status >= 200 && res.status < 300) { await markInvited(o.phone); sent++ } else failed++
    } catch { failed++ }
  }
  return NextResponse.json({ ok: true, sent, failed, invited: await invitedCount() })
}
