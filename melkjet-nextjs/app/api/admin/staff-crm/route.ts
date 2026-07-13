import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listAccounts, getAccount } from '@/app/lib/account-store'
import { listRoles } from '@/app/lib/role-store'
import { staffCrmAll, addStaffAct, setStaffStatus, assignStaff, markActDone, type StaffCrmStatus } from '@/app/lib/staff-crm-store'
import { logAudit } from '@/app/lib/audit-store'

// 📞 فاز ۱۱۶ — CRM مرکزیِ پرسنل: مشتری = اکانتِ واقعیِ سایت؛ پرسنل تماس/پیگیری/یادداشت ثبت می‌کنند.
// دسترسی: سوپرادمین یا پرسنلِ دارای بخشِ staffCrm (اجرای اصلی در proxy؛ اینجا دفاعِ دوم).
async function guard() {
  const s = await getSession()
  if (!s) return null
  if (s.role === 'super_admin' || (s.staff || []).includes('staffCrm')) return s
  return null
}
const byName = async (phone: string) => { const a = getAccount(phone); return (a?.name ? `${a.name} (${phone})` : phone) }

export async function GET(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const sp = new URL(req.url).searchParams
  const q = (sp.get('q') || '').trim()
  const status = sp.get('status') || ''
  const roleFa = new Map(listRoles().map(r => [r.id, r.name]))
  const crm = await staffCrmAll()
  const now = Date.now()

  const rows = listAccounts()
    .map(a => {
      const e = crm[a.phone]
      const lastAct = e?.acts[e.acts.length - 1]
      const due = (e?.acts || []).filter(x => x.dueAt && !x.done && x.dueAt <= now + 864e5)   // سررسیدِ امروز/گذشته
      return {
        phone: a.phone, name: a.name || '', role: roleFa.get(a.role || '') || a.role || '',
        plan: a.plan || '', lastLogin: a.lastLogin || a.createdAt, createdAt: a.createdAt,
        status: e?.status || 'new', assignedTo: e?.assignedTo || '', acts: e?.acts.length || 0,
        lastActAt: lastAct?.at || 0, lastActText: lastAct ? `${lastAct.by.split(' (')[0]}: ${lastAct.text.slice(0, 60)}` : '',
        dueCount: due.length,
      }
    })
    .filter(r => !status || r.status === status)
    .filter(r => !q || r.phone.includes(q) || r.name.includes(q))
    .sort((a, b) => (b.lastActAt || b.lastLogin || 0) - (a.lastActAt || a.lastLogin || 0))

  // پیگیری‌های سررسیدِ امروز (کلِ مشتریان) — صفِ کارِ پرسنل
  const dueToday = Object.entries(crm).flatMap(([phone, e]) =>
    e.acts.filter(x => x.dueAt && !x.done && x.dueAt <= now + 864e5)
      .map(x => ({ phone, name: rows.find(r => r.phone === phone)?.name || '', at: x.at, dueAt: x.dueAt!, text: x.text, by: x.by })))
    .sort((a, b) => a.dueAt - b.dueAt).slice(0, 60)

  return NextResponse.json({ ok: true, rows: rows.slice(0, 400), total: rows.length, dueToday })
}

export async function POST(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const phone = String(b.phone || '')
  if (!phone || !getAccount(phone)) return NextResponse.json({ error: 'مشتری (اکانتِ سایت) یافت نشد' }, { status: 404 })
  const action = String(b.action || '')

  if (action === 'act') {
    const kind = ['call', 'follow', 'note', 'sms'].includes(String(b.kind)) ? String(b.kind) as 'call' | 'follow' | 'note' | 'sms' : 'note'
    const text = String(b.text || '').trim()
    if (!text) return NextResponse.json({ error: 'متنِ فعالیت را بنویس' }, { status: 400 })
    const dueAt = Number(b.dueAt) > Date.now() - 864e5 ? Number(b.dueAt) : undefined
    const e = await addStaffAct(phone, { by: await byName(s.phone), kind, text, dueAt })
    return NextResponse.json({ ok: true, entry: e })
  }
  if (action === 'status') {
    const st = String(b.status || '')
    if (!['new', 'follow', 'customer', 'lost'].includes(st)) return NextResponse.json({ error: 'وضعیتِ نامعتبر' }, { status: 400 })
    const e = await setStaffStatus(phone, st as StaffCrmStatus)
    if (st === 'customer') logAudit(s.phone, 'CRM مرکزی: مشتری شد', phone)
    return NextResponse.json({ ok: true, entry: e })
  }
  if (action === 'assign') {
    const e = await assignStaff(phone, String(b.to || ''))
    return NextResponse.json({ ok: true, entry: e })
  }
  if (action === 'done') {
    await markActDone(phone, Number(b.actAt) || 0)
    return NextResponse.json({ ok: true })
  }
  if (action === 'entry') {
    const crm = await staffCrmAll()
    const a = getAccount(phone)
    return NextResponse.json({ ok: true, entry: crm[phone] || { status: 'new', acts: [] }, account: { name: a?.name || '', role: a?.role || '', plan: a?.plan || '', lastLogin: a?.lastLogin || 0, createdAt: a?.createdAt || 0 } })
  }
  return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
}
