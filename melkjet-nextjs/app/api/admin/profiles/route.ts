import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listAccounts, getAccount, dashForRole } from '@/app/lib/account-store'
import { listRoles } from '@/app/lib/role-store'
import { listPlans } from '@/app/lib/plan-store'
import { listTasks } from '@/app/lib/crm-store'
import { listLeads } from '@/app/lib/leads-store'
import { listWorkflows } from '@/app/lib/workflow-store'
import { getPrefs } from '@/app/lib/user-store'
import { ownerStats } from '@/app/lib/owner-store'
import { buyerStats } from '@/app/lib/buyer-store'
import { advisorStats } from '@/app/lib/advisor-store'
import { agencyStats } from '@/app/lib/agency-store'
import { getShop } from '@/app/lib/materials-store'

import { getProfile, completeness } from '@/app/lib/profile-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

// فعالیتِ واقعی (بدون seed) که در همهٔ نقش‌ها مشترک است.
async function commonActivity(phone: string) {
  return {
    tasks: (await listTasks(phone)).length,
    leads: (await listLeads(phone)).length,
    workflows: (await listWorkflows(phone)).length,
    favorites: getPrefs(phone).favorites.length,
  }
}

// نگاشت نقش → برچسب/داشبورد
function roleLabel(roleId?: string): string {
  if (!roleId) return '—'
  const r = listRoles(false).find(x => x.id === roleId || x.name === roleId)
  return r?.name || roleId
}
function planLabel(planId?: string): string {
  if (!planId) return 'بدون پلن'
  const p = listPlans().find(x => x.id === planId)
  return p?.name || planId
}

export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const phone = new URL(req.url).searchParams.get('phone')

  // ── لیست همهٔ پروفایل‌ها ──
  if (!phone) {
    const accounts = listAccounts()
    const profiles = await Promise.all(accounts.map(async a => ({
      phone: a.phone,
      name: a.name || '',
      role: a.role || '',
      roleLabel: roleLabel(a.role),
      plan: a.plan || '',
      planLabel: planLabel(a.plan),
      dashboard: dashForRole(a.role),
      onboarded: a.onboarded,
      createdAt: a.createdAt,
      lastLogin: a.lastLogin || null,
      activity: await commonActivity(a.phone),
    })))
    return NextResponse.json({
      profiles,
      roles: listRoles(true).map(r => ({ id: r.id, name: r.name })),
      plans: listPlans().map(p => ({ id: p.id, name: p.name })),
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  }

  // ── جزئیات یک پروفایل ──
  const acct = getAccount(phone)
  if (!acct) return NextResponse.json({ error: 'پروفایل یافت نشد' }, { status: 404 })
  const dashboard = dashForRole(acct.role)

  let kpis: { label: string; value: number; money?: boolean }[] = []
  let sections: { title: string; items: { primary: string; secondary?: string }[] }[] = []

  try {
    if (dashboard === '/owner') {
      const s = ownerStats(phone)
      kpis = [
        { label: 'کل ملک‌ها', value: s.kpis.totalProps },
        { label: 'آگهی فعال', value: s.kpis.activeCount },
        { label: 'درخواست جدید', value: s.kpis.newInquiries },
        { label: 'بازدید پیش‌رو', value: s.kpis.upcomingViewings },
        { label: 'پیشنهاد در انتظار', value: s.kpis.pendingOffers },
        { label: 'ارزش پورتفوی', value: s.kpis.portfolio, money: true },
      ]
      sections = [{ title: 'آخرین درخواست‌ها', items: s.recentInquiries.map(q => ({ primary: q.name, secondary: q.message || '' })) }]
    } else if (dashboard === '/buyer') {
      const s = await buyerStats(phone)
      kpis = [
        { label: 'ملک‌های ذخیره‌شده', value: s.kpis.savedCount },
        { label: 'جستجوهای ذخیره‌شده', value: s.kpis.searchCount },
        { label: 'بازدید پیش‌رو', value: s.kpis.upcomingViewings },
        { label: 'پیام خوانده‌نشده', value: s.kpis.unreadMessages },
        { label: 'پیشنهاد در انتظار', value: s.kpis.pendingOffers },
      ]
      sections = [{ title: 'ملک‌های ذخیره‌شده اخیر', items: s.recentSaved.map(p => ({ primary: p.title, secondary: p.location })) }]
    } else if (dashboard === '/pros') {
      const s = advisorStats(phone)
      kpis = [
        { label: 'لیدهای فعال', value: s.kpis.activeLeads },
        { label: 'لید داغ', value: s.kpis.hotLeads },
        { label: 'آگهی فعال', value: s.kpis.activeListings },
        { label: 'جلسات پیش‌رو', value: s.kpis.upcomingAppts },
        { label: 'معاملات این ماه', value: s.kpis.dealsThisMonth },
        { label: 'کمیسیون در انتظار', value: s.kpis.pendingCommission, money: true },
      ]
      sections = [{ title: 'آخرین لیدها', items: s.recentLeads.map(l => ({ primary: l.name, secondary: l.need || '' })) }]
    } else if (dashboard === '/agency') {
      const s = agencyStats(phone)
      kpis = [
        { label: 'مشاوران فعال', value: s.kpis.activeAgents },
        { label: 'کل مشاوران', value: s.kpis.totalAgents },
        { label: 'آگهی فعال', value: s.kpis.activeListings },
        { label: 'لید باز', value: s.kpis.openLeads },
        { label: 'معاملات این ماه', value: s.kpis.dealsThisMonth },
        { label: 'فروش این ماه', value: s.kpis.monthSales, money: true },
      ]
    } else if (dashboard === '/materials') {
      const shop = getShop(phone)
      const newOrders = shop.orders.filter(o => o.status === 'pending').length
      const lowStock = shop.products.filter(p => typeof p.stock === 'number' && p.stock <= 5).length
      kpis = [
        { label: 'محصولات', value: shop.products.length },
        { label: 'سفارش‌ها', value: shop.orders.length },
        { label: 'سفارش جدید', value: newOrders },
        { label: 'استعلام‌ها', value: shop.inquiries.length },
        { label: 'کم‌موجودی', value: lowStock },
      ]
      sections = [{ title: 'آخرین سفارش‌ها', items: shop.orders.slice(0, 6).map(o => ({ primary: o.customer, secondary: `${o.items.toLocaleString('fa-IR')} قلم` })) }]
    }
  } catch {
    // اگر استورِ نقش خطا داد، فقط فعالیت عمومی را نشان می‌دهیم.
  }

  const profile = getProfile(phone)
  return NextResponse.json({
    account: {
      phone: acct.phone, name: acct.name || '', role: acct.role || '', roleLabel: roleLabel(acct.role),
      plan: acct.plan || '', planLabel: planLabel(acct.plan), onboarded: acct.onboarded,
      createdAt: acct.createdAt, lastLogin: acct.lastLogin || null, dashboard,
      // هویتِ رسمیِ شاهکار
      identityVerifiedAt: acct.identityVerifiedAt || null, nationalId: acct.nationalId || '',
      fatherName: acct.fatherName || '', gender: acct.gender || '', birthDate: acct.birthDate || '', birthPlace: acct.birthPlace || '',
      idNumber: acct.idNumber || '', idSerial: acct.idSerial || '',
    },
    profile, completeness: completeness(profile),
    kpis,
    sections,
    activity: await commonActivity(phone),
  }, { headers: { 'Cache-Control': 'no-store, private' } })
}
