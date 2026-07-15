import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listAccounts, adminUpdate, deleteAccount, bulkUpdate, bulkDelete, createAccount, setSuspended, setCap, setPlan, isProtectedAccount } from '@/app/lib/account-store'
import { saveProfile, getProfile, completeness } from '@/app/lib/profile-store'
import { listRoles, dashForRoleId } from '@/app/lib/role-store'
import { listPlans, getPlan } from '@/app/lib/plan-store'
import { getCredit, getTokenUsage, grantCredit } from '@/app/lib/comm-store'
import { logAudit } from '@/app/lib/audit-store'
import { listItems } from '@/app/lib/scraper-store'
import { listTasks } from '@/app/lib/crm-store'
import { listLeads } from '@/app/lib/leads-store'

async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) ? s : null }

// فاز ۱۲۴ — حساب‌های محافظت‌شده: پرسنل هرگز نمی‌تواند سوپرادمین یا پرسنلِ دیگر (دارندهٔ دسترسیِ پنل) را تغییر/تعلیق/حذف کند
function protectedTarget(actorRole: string | undefined, phones: unknown[]): string | null {
  if (actorRole === 'super_admin') return null
  for (const ph of phones.map(p => String(p || '')).filter(Boolean)) {
    if (isProtectedAccount(ph)) return ph
  }
  return null
}
const PROTECTED_ERR = (ph: string) => NextResponse.json({ error: `حسابِ ${ph} محافظت‌شده است (سوپرادمین/پرسنل) — فقط سوپرادمین می‌تواند آن را تغییر دهد` }, { status: 403 })

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
  // فاز ۱۲۴ — پرسنلِ دارای بخشِ «کاربران» هم می‌تواند ویرایش کند (ریشهٔ «ذخیره نمی‌شود»)؛
  // اما اعطای دسترسیِ پنل (adminSections) و دست‌زدن به حساب‌های محافظت‌شده همچنان فقط سوپرادمینِ واقعی.
  const s = await getSession()
  if (!s || !(s.role === 'super_admin' || (s.staff || []).length > 0)) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const prot = protectedTarget(s.role, Array.isArray(b.phones) ? b.phones : [b.phone])
  if (prot) return PROTECTED_ERR(prot)
  // فاز ۱۱۵ — اعطای دسترسیِ پرسنل به بخش‌های پنلِ ادمین (فقط سوپرادمینِ واقعی؛ هرگز پرسنل):
  if (b.adminSections !== undefined) {
    if (s.role !== 'super_admin') return NextResponse.json({ error: 'اعطای دسترسیِ پنل فقط کارِ سوپرادمین است' }, { status: 403 })
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
  // فاز ۱۴۲ (فیدبک: «دیوار احراز نمی‌کند؛ یک نفر دو شماره/دو حساب دارد») — ادغامِ دو حساب.
  // b.phone = حسابِ اصلی (می‌ماند)، b.mergeFrom = حسابِ دوم (داده‌اش منتقل و خودش تعلیق می‌شود).
  if (b.mergeFrom !== undefined) {
    if (s.role !== 'super_admin') return NextResponse.json({ error: 'ادغامِ حساب فقط کارِ سوپرادمین است' }, { status: 403 })
    const { mergeUserAccounts } = await import('@/app/lib/account-merge')
    const r = await mergeUserAccounts(String(b.phone || ''), String(b.mergeFrom || ''))
    if (!r.ok) return NextResponse.json({ error: r.error || 'ادغام ناموفق بود' }, { status: 400 })
    logAudit(s.phone, 'ادغامِ دو حساب', `${b.mergeFrom} ← ${b.phone} (فایل ${r.advisorListings ?? 0}، لید ${(r.advisorLeads ?? 0) + (r.leads ?? 0)}، آگهیِ عمومی ${r.publicListings ?? 0}، وظیفه ${r.tasks ?? 0}، منبعِ دیوار ${r.divarSources ?? 0})`)
    return NextResponse.json({ ok: true, merged: r })
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
  if (Array.isArray(b.phones)) { bulkUpdate(b.phones, b.patch || {}); logAudit(s.phone, 'ویرایشِ گروهیِ کاربران', `${b.phones.length} حساب`); return NextResponse.json({ ok: true }) }
  if (!b.phone) return NextResponse.json({ error: 'شماره الزامی است' }, { status: 400 })
  if (b.suspend !== undefined) {
    setSuspended(String(b.phone), !!b.suspend)
    // فاز ۱۲۷ — رفعِ تعلیقِ دستی باید بماند: معافیت از موتورِ تعلیقِ خودکار (و تعلیقِ دستی معافیت را برمی‌دارد)
    const { setGateExempt } = await import('@/app/lib/account-store')
    setGateExempt(String(b.phone), !b.suspend)
    logAudit(s.phone, b.suspend ? 'تعلیقِ کاربر' : 'رفعِ تعلیقِ کاربر (معاف از تعلیقِ خودکار)', String(b.phone))
    return NextResponse.json({ ok: true })
  }
  // فاز ۱۲۷ — کنترلِ مستقیمِ معافیت از تعلیقِ خودکار (چیپِ کشوی کاربر)
  if (b.gateExempt !== undefined) {
    const { setGateExempt } = await import('@/app/lib/account-store')
    setGateExempt(String(b.phone), !!b.gateExempt)
    logAudit(s.phone, b.gateExempt ? 'معافیت از تعلیقِ خودکار' : 'لغوِ معافیت از تعلیقِ خودکار', String(b.phone))
    return NextResponse.json({ ok: true })
  }
  // دادن/گرفتنِ دسترسیِ ویژه (مثلِ 'catalog' برای مدیریتِ کاتالوگ و اسکرپِ هایپرساز)
  if (b.cap) { const a = setCap(String(b.phone), String(b.cap), !!b.on); if (!a) return NextResponse.json({ error: 'کاربر یافت نشد' }, { status: 404 }); return NextResponse.json({ ok: true, user: a }) }
  const a = adminUpdate(b.phone, b.patch || {})
  if (!a) return NextResponse.json({ error: 'کاربر یافت نشد' }, { status: 404 })
  logAudit(s.phone, 'ویرایشِ کاربر', `${b.phone} → ${Object.keys(b.patch || {}).join('، ') || '—'}`)
  return NextResponse.json({ ok: true, user: a })
}

export async function DELETE(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const phone = new URL(req.url).searchParams.get('phone')
  if (phone) {
    const prot = protectedTarget(s.role, [phone])
    if (prot) return PROTECTED_ERR(prot)
    deleteAccount(phone); logAudit(s.phone, 'حذفِ کاربر', phone)
    return NextResponse.json({ ok: true })
  }
  const b = await req.json().catch(() => ({}))
  if (Array.isArray(b.phones)) {
    const prot = protectedTarget(s.role, b.phones)
    if (prot) return PROTECTED_ERR(prot)
    bulkDelete(b.phones); logAudit(s.phone, 'حذفِ گروهیِ کاربران', `${b.phones.length} حساب`)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'شماره الزامی است' }, { status: 400 })
}
