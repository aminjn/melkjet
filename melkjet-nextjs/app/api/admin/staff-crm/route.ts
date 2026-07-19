import { NextRequest, NextResponse } from 'next/server'
import { getSession, SUPER_ADMIN_PHONE } from '@/app/lib/session'
import { listAccounts, getAccount } from '@/app/lib/account-store'
import { listRoles } from '@/app/lib/role-store'
import { staffCrmAll, addStaffAct, setStaffStatus, assignStaff, markActDone, updateStaffAct, deleteStaffAct, listStaffTasks, addStaffTask, toggleStaffTask, deleteStaffTask, type StaffCrmStatus } from '@/app/lib/staff-crm-store'
import { logAudit } from '@/app/lib/audit-store'
import { listByOwner } from '@/app/lib/ticket-store'
import { getPrefs } from '@/app/lib/user-store'
import { listOrders } from '@/app/lib/comm-store'
import { getEmpire, empireLevel } from '@/app/lib/empire-store'
import { sendServiceSms } from '@/app/lib/sms'
import { advisorWorkSummary } from '@/app/lib/advisor-store'
import { agencyWorkSummary } from '@/app/lib/agency-store'
import { listAllLeads } from '@/app/lib/leads-store'

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
  // فاز ۱۲۲: داراییِ کاریِ هر مشتری بر اساسِ نقشش (فایل/لید/قرار) — از استورهای واقعیِ خودشان
  const [advW, agW, allLeads] = await Promise.all([
    advisorWorkSummary().catch(() => ({} as Record<string, { leads: number; listings: number; appts: number }>)),
    agencyWorkSummary().catch(() => ({} as Record<string, { leads: number; listings: number; agents: number; deals: number }>)),
    listAllLeads().catch(() => []),
  ])
  const crmLeadsByOwner: Record<string, number> = {}
  for (const l of allLeads) { const o = l.owner || ''; if (o) crmLeadsByOwner[o] = (crmLeadsByOwner[o] || 0) + 1 }

  const rows = listAccounts()
    .filter(a => !a.mergedInto && !/^ادغام‌شده/.test(a.suspendReason || ''))   // فاز ۱۴۳: حسابِ ادغام‌شده «همان مشتری» است — دوبار در CRM نیاید (+ ادغام‌های قدیمیِ بدونِ فیلد)
    .map(a => {
      const e = crm[a.phone]
      const lastAct = e?.acts[e.acts.length - 1]
      const due = (e?.acts || []).filter(x => x.dueAt && !x.done && x.dueAt <= now + 864e5)   // سررسیدِ امروز/گذشته
      return {
        phone: a.phone, name: a.name || '', role: roleFa.get(a.role || '') || a.role || '',
        plan: a.plan || '', lastLogin: a.lastLogin || a.createdAt, createdAt: a.createdAt,
        status: e?.status || 'new', assignedTo: e?.assignedTo || '', acts: e?.acts.length || 0,
        files: (advW[a.phone]?.listings || 0) + (agW[a.phone]?.listings || 0),
        leads: (crmLeadsByOwner[a.phone] || 0) + (advW[a.phone]?.leads || 0) + (agW[a.phone]?.leads || 0),
        appts: advW[a.phone]?.appts || 0,
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
  // تبِ «پیگیری‌ها»: همهٔ یادآوری‌های آینده (باز) + انجام‌شده‌های اخیر
  const upcoming = Object.entries(crm).flatMap(([phone, e]) =>
    e.acts.filter(x => x.dueAt && !x.done && x.dueAt > now + 864e5)
      .map(x => ({ phone, name: rows.find(r => r.phone === phone)?.name || '', at: x.at, dueAt: x.dueAt!, text: x.text, by: x.by })))
    .sort((a, b) => a.dueAt - b.dueAt).slice(0, 80)
  const doneRecent = Object.entries(crm).flatMap(([phone, e]) =>
    e.acts.filter(x => x.dueAt && x.done)
      .map(x => ({ phone, name: rows.find(r => r.phone === phone)?.name || '', dueAt: x.dueAt!, text: x.text, by: x.by })))
    .sort((a, b) => b.dueAt - a.dueAt).slice(0, 40)
  // گزارشِ عملکردِ پرسنل: هر همکار چند تماس/پیامک/یادداشت/پیگیری ثبت کرده (پاسخ‌گویی)
  const perf: Record<string, { calls: number; sms: number; notes: number; follows: number; total: number; lastAt: number }> = {}
  for (const e of Object.values(crm)) for (const a of e.acts) {
    const k = a.by.split(' (')[0]
    const g = perf[k] || (perf[k] = { calls: 0, sms: 0, notes: 0, follows: 0, total: 0, lastAt: 0 })
    if (a.kind === 'call') g.calls++; else if (a.kind === 'sms') g.sms++; else if (a.kind === 'follow') g.follows++; else g.notes++
    g.total++; g.lastAt = Math.max(g.lastAt, a.at)
  }
  const report = Object.entries(perf).map(([name, g]) => ({ name, ...g })).sort((a, b) => b.total - a.total)
  // فاز ۱۲۳ — وظایفِ تیمی
  const tasks = await listStaffTasks()
  // فاز ۱۷۴ — فهرستِ پرسنلِ واقعیِ ملک‌جت برای دراپ‌داونِ ارجاع: دارندگانِ دسترسیِ پنل + سوپرادمین
  const staffList = listAccounts()
    .filter(a => (a.adminSections || []).length > 0 || a.role === 'staff' || a.phone === SUPER_ADMIN_PHONE)
    .map(a => ({ phone: a.phone, name: a.name || a.phone }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fa'))
  return NextResponse.json({ ok: true, rows: rows.slice(0, 400), total: rows.length, dueToday, upcoming, doneRecent, report, stats, tasks: tasks.slice(0, 120), meName, staffList })
}

export async function POST(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const action = String(b.action || '')

  // ── فاز ۱۲۳: وظایفِ تیمی (مستقل از مشتری — الزامِ phone ندارند) ──
  if (action === 'taskAdd') {
    const title = String(b.title || '').trim()
    if (!title) return NextResponse.json({ error: 'عنوانِ وظیفه را بنویس' }, { status: 400 })
    const forPhone = String(b.forPhone || '').trim()
    const forAcc = forPhone ? getAccount(forPhone) : null
    if (forPhone && !forAcc) return NextResponse.json({ error: 'مشتریِ مرتبط یافت نشد' }, { status: 404 })
    const t = await addStaffTask({
      title, by: await byName(s.phone), byPhone: s.phone,
      assignedTo: String(b.assignedTo || '').trim().slice(0, 40) || undefined,
      forPhone: forPhone || undefined, forName: forAcc?.name || undefined,
      dueAt: Number(b.dueAt) > Date.now() - 864e5 ? Number(b.dueAt) : undefined,
    })
    return NextResponse.json({ ok: true, task: t, tasks: await listStaffTasks() })
  }
  if (action === 'taskToggle') {
    await toggleStaffTask(String(b.id || ''), await byName(s.phone))
    return NextResponse.json({ ok: true, tasks: await listStaffTasks() })
  }
  if (action === 'taskDelete') {
    await deleteStaffTask(String(b.id || ''))
    return NextResponse.json({ ok: true, tasks: await listStaffTasks() })
  }

  const phone = String(b.phone || '')
  if (!phone || !getAccount(phone)) return NextResponse.json({ error: 'مشتری (اکانتِ سایت) یافت نشد' }, { status: 404 })

  if (action === 'act') {
    const kind = ['call', 'follow', 'note', 'sms'].includes(String(b.kind)) ? String(b.kind) as 'call' | 'follow' | 'note' | 'sms' : 'note'
    const text = String(b.text || '').trim()
    if (!text) return NextResponse.json({ error: 'متنِ فعالیت را بنویس' }, { status: 400 })
    let dueAt = Number(b.dueAt) > Date.now() - 864e5 ? Number(b.dueAt) : undefined
    // فاز ۱۷۳ («همه‌چیز اتومات»): «پیگیری» بدونِ سررسید معنا ندارد — خودکار ۳ روزِ بعد، ساعتِ همین لحظه
    if (kind === 'follow' && !dueAt) dueAt = Date.now() + 3 * 864e5
    const e = await addStaffAct(phone, { by: await byName(s.phone), byPhone: s.phone, kind, text, dueAt })
    return NextResponse.json({ ok: true, entry: e, autoDue: kind === 'follow' && !Number(b.dueAt) ? dueAt : undefined })
  }
  // فاز ۱۷۳ — ویرایش/حذف/تعویقِ پیگیری: CRM واقعی، نه فقط ثبتِ یک‌طرفه
  if (action === 'actEdit') {
    const patch: { text?: string; dueAt?: number | null } = {}
    if (b.text !== undefined) { const t = String(b.text || '').trim(); if (!t) return NextResponse.json({ error: 'متن خالی است' }, { status: 400 }); patch.text = t }
    if (b.dueAt !== undefined) patch.dueAt = b.dueAt === null || b.dueAt === 0 ? null : Number(b.dueAt)
    const a = await updateStaffAct(phone, Number(b.actAt) || 0, patch)
    if (!a) return NextResponse.json({ error: 'فعالیت یافت نشد' }, { status: 404 })
    return NextResponse.json({ ok: true, act: a })
  }
  if (action === 'actDelete') {
    const okDel = await deleteStaffAct(phone, Number(b.actAt) || 0)
    if (!okDel) return NextResponse.json({ error: 'فعالیت یافت نشد' }, { status: 404 })
    logAudit(s.phone, 'CRM مرکزی: حذفِ فعالیت', phone)
    return NextResponse.json({ ok: true })
  }
  if (action === 'actSnooze') {
    const days = Math.max(1, Math.min(30, Number(b.days) || 1))
    const crmAll = await staffCrmAll()
    const cur = crmAll[phone]?.acts.find(x => x.at === (Number(b.actAt) || 0))
    if (!cur || !cur.dueAt) return NextResponse.json({ error: 'پیگیری یافت نشد' }, { status: 404 })
    const a = await updateStaffAct(phone, cur.at, { dueAt: Math.max(Date.now(), cur.dueAt) + days * 864e5 })
    return NextResponse.json({ ok: true, act: a })
  }
  if (action === 'status') {
    const st = String(b.status || '')
    if (!['new', 'follow', 'customer', 'lost'].includes(st)) return NextResponse.json({ error: 'وضعیتِ نامعتبر' }, { status: 400 })
    const e = await setStaffStatus(phone, st as StaffCrmStatus)
    if (st === 'customer') logAudit(s.phone, 'CRM مرکزی: مشتری شد', phone)
    return NextResponse.json({ ok: true, entry: e })
  }
  if (action === 'assign') {
    // فاز ۱۷۴ — ارجاع از دراپ‌داونِ پرسنل: `to` شمارهٔ پرسنل است (خالی = برداشتنِ مسئول).
    // ذخیره به شکلِ «نام (شماره)» تا فیلترِ «فقط کارهای من» دقیق بماند + اطلاعِ خودکار به پرسنل.
    const toPhone = String(b.to || '').replace(/\D/g, '')
    if (!toPhone) { const e0 = await assignStaff(phone, ''); return NextResponse.json({ ok: true, entry: e0 }) }
    const toAcc = getAccount(toPhone)
    if (!toAcc || !((toAcc.adminSections || []).length > 0 || toAcc.role === 'staff' || toPhone === SUPER_ADMIN_PHONE))
      return NextResponse.json({ error: 'این شماره جزوِ پرسنلِ ملک‌جت نیست' }, { status: 400 })
    const label = `${toAcc.name || toPhone} (${toPhone})`
    const e = await assignStaff(phone, label)
    logAudit(s.phone, `CRM مرکزی: ارجاع به ${toAcc.name || toPhone}`, phone)
    // اطلاعِ خودکار به پرسنلِ مقصد (پوش + پیامک) — خودارجاعی پیام نمی‌خواهد
    if (toPhone !== s.phone) {
      const cust = getAccount(phone)
      const body = `👤 مشتریِ جدید به تو ارجاع شد: ${cust?.name || phone} (${phone})`
      try {
        const { listForPhone, removeByEndpoint } = await import('@/app/lib/push-store')
        const { sendPush } = await import('@/app/lib/web-push')
        for (const sub of listForPhone(toPhone)) {
          try { const st = await sendPush(sub, { title: '📞 ارجاعِ CRM ملک‌جت', body, url: '/admin', tag: 'mj-staff-crm' }); if (st === 404 || st === 410) removeByEndpoint(sub.endpoint) } catch {}
        }
      } catch { /* پوش اختیاری */ }
      try { await sendServiceSms(toPhone, `${body}\nپنلِ CRM را باز کن.`, 'ارجاعِ CRM پرسنل') } catch { /* بی‌صدا */ }
    }
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
    const e = await addStaffAct(phone, { by: await byName(s.phone), byPhone: s.phone, kind: 'sms', text: `پیامک ارسال شد: ${text}` })
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
