import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listAccounts, getAccount } from '@/app/lib/account-store'
import { listRoles } from '@/app/lib/role-store'
import { staffCrmAll, addStaffAct, setStaffStatus, assignStaff, markActDone, type StaffCrmStatus } from '@/app/lib/staff-crm-store'
import { logAudit } from '@/app/lib/audit-store'
import { listByOwner } from '@/app/lib/ticket-store'
import { getPrefs } from '@/app/lib/user-store'
import { listOrders } from '@/app/lib/comm-store'
import { getEmpire, empireLevel } from '@/app/lib/empire-store'
import { sendServiceSms } from '@/app/lib/sms'

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
  const mine = sp.get('mine') === '1'
  const meName = (getAccount(s.phone)?.name || '').trim()
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
    .filter(r => !mine || (r.assignedTo && (r.assignedTo === meName || r.assignedTo.includes(s.phone))))
    .filter(r => !q || r.phone.includes(q) || r.name.includes(q))
    .sort((a, b) => (b.lastActAt || b.lastLogin || 0) - (a.lastActAt || a.lastLogin || 0))

  // پیگیری‌های سررسیدِ امروز (کلِ مشتریان) — صفِ کارِ پرسنل
  const dueToday = Object.entries(crm).flatMap(([phone, e]) =>
    e.acts.filter(x => x.dueAt && !x.done && x.dueAt <= now + 864e5)
      .map(x => ({ phone, name: rows.find(r => r.phone === phone)?.name || '', at: x.at, dueAt: x.dueAt!, text: x.text, by: x.by })))
    .sort((a, b) => a.dueAt - b.dueAt).slice(0, 60)

  // KPIهای واقعی برای سربرگ — از همان ردیف‌های محاسبه‌شده
  const weekAgo = now - 7 * 864e5
  const stats = {
    total: rows.length,
    newWeek: rows.filter(r => r.createdAt >= weekAgo).length,
    follow: rows.filter(r => r.status === 'follow').length,
    customer: rows.filter(r => r.status === 'customer').length,
    due: dueToday.length,
  }
  return NextResponse.json({ ok: true, rows: rows.slice(0, 400), total: rows.length, dueToday, stats })
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
  // 📲 ارسالِ پیامکِ «واقعی» به مشتری از داخلِ پرونده (IPPanel) + ثبتِ خودکار در تایم‌لاین
  if (action === 'sms') {
    const text = String(b.text || '').trim().slice(0, 320)
    if (!text) return NextResponse.json({ error: 'متنِ پیامک را بنویس' }, { status: 400 })
    const r = await sendServiceSms(phone, text, 'CRM مرکزی ملک‌جت')
    if (!r.ok) return NextResponse.json({ error: r.error || 'ارسالِ پیامک ناموفق بود — تنظیماتِ IPPanel را چک کن' }, { status: 502 })
    const e = await addStaffAct(phone, { by: await byName(s.phone), kind: 'sms', text: `پیامک ارسال شد: ${text}` })
    logAudit(s.phone, 'CRM مرکزی: ارسالِ پیامک', phone)
    return NextResponse.json({ ok: true, entry: e })
  }
  // پروندهٔ ۳۶۰ درجه: همهٔ ردپاهای واقعیِ این مشتری در کلِ سیستم — تیکت، سفارش، پلن، امپراتوری، علاقه‌مندی
  if (action === 'entry') {
    const crm = await staffCrmAll()
    const a = getAccount(phone)
    const [tickets, prefs, orders, emp] = await Promise.all([
      listByOwner(phone).catch(() => []),
      getPrefs(phone).catch(() => ({ favorites: [], savedSearches: [] } as { favorites: string[]; savedSearches: unknown[] })),
      listOrders(phone).catch(() => []),
      getEmpire(phone).catch(() => null),
    ])
    const roleFa = new Map(listRoles().map(r => [r.id, r.name]))
    return NextResponse.json({
      ok: true,
      entry: crm[phone] || { status: 'new', acts: [] },
      account: {
        name: a?.name || '', fullName: a?.fullName || '', role: roleFa.get(a?.role || '') || a?.role || '',
        plan: a?.plan || '', planExpiresAt: a?.planExpiresAt || 0,
        lastLogin: a?.lastLogin || 0, createdAt: a?.createdAt || 0,
        verified: !!a?.identityVerifiedAt, suspended: !!a?.suspended,
      },
      tickets: {
        total: tickets.length, open: tickets.filter(t => t.status !== 'closed').length,
        last: tickets.slice(0, 3).map(t => ({ subject: t.subject, status: t.status, at: (t as unknown as { createdAt?: number; at?: number }).createdAt || (t as unknown as { at?: number }).at || 0 })),
      },
      orders: orders.slice(0, 6).map(o => ({ name: o.name, kind: o.kind, price: o.price, status: o.status, at: o.createdAt, receipt: !!o.receipt })),
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      empire: emp ? { level: empireLevel(emp.xp).level, capital: emp.capital, assets: emp.assets.length, coins: emp.coins } : null,
      interests: { favorites: (prefs.favorites || []).length, savedSearches: (prefs.savedSearches || []).length },
    })
  }
  return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
}
