import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listAccounts, adminUpdate, deleteAccount, bulkUpdate, bulkDelete, createAccount, setSuspended, setCap, setPlan } from '@/app/lib/account-store'
import { saveProfile, getProfile, completeness } from '@/app/lib/profile-store'
import { listRoles, dashForRoleId } from '@/app/lib/role-store'
import { listPlans, getPlan } from '@/app/lib/plan-store'
import { getCredit, getTokenUsage, grantCredit } from '@/app/lib/comm-store'
import { logAudit } from '@/app/lib/audit-store'
import { listItems } from '@/app/lib/scraper-store'
import { listTasks } from '@/app/lib/crm-store'
import { listLeads } from '@/app/lib/leads-store'

async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const roleList = listRoles()
  const roles = roleList.map(r => ({ id: r.id, name: r.name }))
  const planList = listPlans()
  // نام‌های تکراریِ پلن‌ها (Pro/Basic/Starter برای چند نقش) بدونِ مخاطب گیج‌کننده بود — نقش/داشبوردِ هر پلن هم می‌رود
  const plans = planList.map(p => ({ id: p.id, name: p.name, dashboard: p.dashboard || '', roleName: p.roleId ? (roleList.find(r => r.id === p.roleId)?.name || '') : '' }))
  const roleNameOf = (rid?: string) => { if (!rid) return ''; const r = roleList.find(x => x.id === rid || x.name === rid); return r?.name || rid }
  const planNameOf = (pid?: string) => { if (!pid) return ''; const p = planList.find(x => x.id === pid); return p?.name || pid }
  // شمارشِ آگهیِ هر مالک
  const listingCounts: Record<string, number> = {}
  for (const it of await listItems('listing')) { const ph = String(it.meta?.__ownerPhone || ''); if (ph) listingCounts[ph] = (listingCounts[ph] || 0) + 1 }
  // اطلاعاتِ کامل‌ترِ هر کاربر بر اساسِ پروفایلش
  const users = await Promise.all(listAccounts().map(async a => {
    const credit = await getCredit(a.phone)
    let leads = 0, tasks = 0
    try { leads = (await listLeads(a.phone)).length } catch {}
    try { tasks = (await listTasks(a.phone)).length } catch {}
    return { ...a, roleName: roleNameOf(a.role), planName: planNameOf(a.plan), dashboard: dashForRoleId(a.role), listings: listingCounts[a.phone] || 0, leads, tasks, credit, tokenUsed: await getTokenUsage(a.phone), profileCompletion: completeness(getProfile(a.phone)) }
  }))
  return NextResponse.json({ users, roles, plans })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const r = createAccount(String(b.phone || ''), { name: b.name, role: b.role, plan: b.plan, identity: b.identity, verified: !!b.verified })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  // پروفایلِ کسب‌وکار (اگر همان لحظه وارد شده باشد)
  if (b.profile && r.account) { try { saveProfile(r.account.phone, b.profile) } catch {} }
  return NextResponse.json({ ok: true, user: r.account })
}

export async function PATCH(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  // فاز ۱۱۵ — اعطای دسترسیِ پرسنل به بخش‌های پنلِ ادمین (فقط سوپرادمینِ واقعی؛ هرگز پرسنل):
  if (b.adminSections !== undefined) {
    const { setAdminSections } = await import('@/app/lib/account-store')
    const { STAFF_GRANTABLE_IDS } = await import('@/app/lib/admin-access')
    const phone115 = String(b.phone || '')
    if (!phone115) return NextResponse.json({ error: 'شماره الزامی است' }, { status: 400 })
    const secs = (Array.isArray(b.adminSections) ? b.adminSections : []).map((x: unknown) => String(x)).filter((x: string) => STAFF_GRANTABLE_IDS.has(x))
    const a115 = setAdminSections(phone115, secs)
    if (!a115) return NextResponse.json({ error: 'کاربر یافت نشد' }, { status: 404 })
    // فاز ۱۱۹: اعطای دسترسی = نقشِ داخلیِ «کارمندانِ ملک‌جت» خودکار می‌نشیند (در فهرستِ کاربران معلوم است چه کسی پرسنل است)
    const { setProfile: setProfile119 } = await import('@/app/lib/account-store')
    const { roleByDashboard } = await import('@/app/lib/role-store')
    if (secs.length && a115.role !== 'staff') setProfile119(phone115, { role: 'staff' })
    if (!secs.length && a115.role === 'staff') setProfile119(phone115, { role: roleByDashboard('/buyer')?.id || '' })   // لغوِ کامل → برگشت به کاربرِ عادی
    logAudit(s.phone, secs.length ? 'اعطای دسترسیِ پنلِ ادمین (پرسنل)' : 'لغوِ دسترسیِ پنلِ ادمین', `${phone115} → ${secs.join('، ') || 'هیچ'}`)
    return NextResponse.json({ ok: true, adminSections: a115.adminSections || [] })
  }
  // فاز ۵۶ (فیدبک: «هر پلنی را برای هر کاربر چند روزِ خاص رایگان بدهم»): هدیهٔ پلنِ زمان‌دار.
  // همان مسیرِ فعال‌سازیِ خریدِ تأییدشده (setPlan با انقضا + شارژِ اعتبارِ AI پلن)، فقط بدونِ پول.
  if (b.grantPlan !== undefined) {
    const phones: string[] = (Array.isArray(b.phones) ? b.phones : [b.phone]).map((p: any) => String(p || '')).filter(Boolean)
    if (!phones.length) return NextResponse.json({ error: 'شماره الزامی است' }, { status: 400 })
    const planId = String(b.grantPlan || '')
    if (!planId) {   // پس‌گرفتنِ پلن (بدون پلن)
      for (const ph of phones) setPlan(ph, '')
      logAudit(s.phone, 'پس‌گرفتنِ پلنِ کاربر', phones.join('، '))
      return NextResponse.json({ ok: true, granted: phones.length })
    }
    const plan = getPlan(planId)
    if (!plan) return NextResponse.json({ error: 'پلن یافت نشد' }, { status: 404 })
    const days = Math.trunc(Number(b.days))
    if (!(days >= 1)) return NextResponse.json({ error: 'تعدادِ روز معتبر نیست (حداقل ۱)' }, { status: 400 })
    const ai = Number(plan.aiCredits) || 0
    for (const ph of phones) {
      setPlan(ph, planId, days * 864e5)
      if (ai > 0) { try { await grantCredit(ph, 'token', ai) } catch {} }
    }
    logAudit(s.phone, `هدیهٔ پلن «${plan.name}» برای ${days} روز${ai > 0 ? ` + ${ai.toLocaleString('fa-IR')} اعتبارِ AI` : ''}`, phones.join('، '))
    return NextResponse.json({ ok: true, granted: phones.length, expiresAt: Date.now() + days * 864e5 })
  }
  // عملیات دسته‌جمعی
  if (Array.isArray(b.phones)) { bulkUpdate(b.phones, b.patch || {}); return NextResponse.json({ ok: true }) }
  if (!b.phone) return NextResponse.json({ error: 'شماره الزامی است' }, { status: 400 })
  if (b.suspend !== undefined) { setSuspended(String(b.phone), !!b.suspend); return NextResponse.json({ ok: true }) }
  // دادن/گرفتنِ دسترسیِ ویژه (مثلِ 'catalog' برای مدیریتِ کاتالوگ و اسکرپِ هایپرساز)
  if (b.cap) { const a = setCap(String(b.phone), String(b.cap), !!b.on); if (!a) return NextResponse.json({ error: 'کاربر یافت نشد' }, { status: 404 }); return NextResponse.json({ ok: true, user: a }) }
  const a = adminUpdate(b.phone, b.patch || {})
  if (!a) return NextResponse.json({ error: 'کاربر یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, user: a })
}

export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const phone = new URL(req.url).searchParams.get('phone')
  if (phone) { deleteAccount(phone); return NextResponse.json({ ok: true }) }
  const b = await req.json().catch(() => ({}))
  if (Array.isArray(b.phones)) { bulkDelete(b.phones); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'شماره الزامی است' }, { status: 400 })
}
