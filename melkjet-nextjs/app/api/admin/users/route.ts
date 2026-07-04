import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listAccounts, adminUpdate, deleteAccount, bulkUpdate, bulkDelete, createAccount, setSuspended, setCap } from '@/app/lib/account-store'
import { saveProfile, getProfile, completeness } from '@/app/lib/profile-store'
import { listRoles, dashForRoleId } from '@/app/lib/role-store'
import { listPlans } from '@/app/lib/plan-store'
import { getCredit, getTokenUsage } from '@/app/lib/comm-store'
import { listItems } from '@/app/lib/scraper-store'
import { listTasks } from '@/app/lib/crm-store'
import { listLeads } from '@/app/lib/leads-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const roleList = listRoles()
  const roles = roleList.map(r => ({ id: r.id, name: r.name }))
  const planList = listPlans()
  const plans = planList.map(p => ({ id: p.id, name: p.name }))
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
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
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
