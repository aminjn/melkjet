import { NextRequest, NextResponse } from 'next/server'
import { resetFailedSms, smsStatus } from '@/app/lib/auto-site'
import { getSession } from '@/app/lib/session'
import { listSites } from '@/app/lib/sites-store'
import { allSiteStats, summarize } from '@/app/lib/site-stats-store'
import { getProfile } from '@/app/lib/profile-store'
import { getAccount } from '@/app/lib/account-store'
import { kvGet, pgEnabled } from '@/app/lib/db'
import { listRoles } from '@/app/lib/role-store'

export const runtime = 'nodejs'

// فاز ۲۹۶ب — پنلِ «سایت‌سازها»: نام/پنلِ کاربر + لینکِ سایت + آمارِ بازدید و جستجو.
async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const [sites, stats] = await Promise.all([listSites(), allSiteStats()])
  const autoMeta = pgEnabled() ? await kvGet<{ done?: Record<string, { at: number; smsAt?: number; manual?: boolean }> }>('autosite_meta', {}) : {}
  const done = autoMeta.done || {}
  const roles = listRoles()
  const roleName = (rid?: string) => { if (!rid) return ''; const r = roles.find(x => x.id === rid || x.name === rid); return r?.name || rid }

  const rows = sites.map(st => {
    const owner = String(st.owner || '')
    const p = owner ? getProfile(owner) : null
    const acc = owner ? getAccount(owner) : null
    const rec = owner ? done[owner] : undefined
    const sm = summarize(stats.get(st.slug))
    return {
      slug: st.slug,
      title: st.title,
      owner,
      ownerName: (p?.businessName || p?.displayName || acc?.name || st.ownerName || '').trim() || owner,
      role: roleName(acc?.role),
      auto: !!rec && !rec.manual,
      smsAt: rec?.smsAt || 0,
      lastLogin: acc?.lastLogin || 0,   // فاز ۲۹۶ب — آخرین ورودِ صاحبِ سایت به پنلش
      createdAt: st.createdAt,
      updatedAt: st.updatedAt,
      today: sm.today, d7v: sm.d7v, d7s: sm.d7s, totalV: sm.totalV, totalS: sm.totalS, lastAt: sm.lastAt,
      topQueries: (stats.get(st.slug)?.queries || []).slice(0, 5).map(x => x.q),
    }
  }).sort((a, b) => (b.d7v - a.d7v) || (b.updatedAt - a.updatedAt))

  const totals = {
    sites: rows.length,
    auto: rows.filter(r => r.auto).length,
    manual: rows.filter(r => !r.auto).length,
    smsSent: rows.filter(r => r.smsAt).length,
    viewsToday: rows.reduce((s, r) => s + r.today, 0),
    views7d: rows.reduce((s, r) => s + r.d7v, 0),
    searches7d: rows.reduce((s, r) => s + r.d7s, 0),
    // فاز ۲۹۶ب — فعالیتِ صاحبانِ سایت: چندتا اصلاً وارد شده‌اند و چندتا در ۷ روزِ اخیر
    loggedInEver: rows.filter(r => r.lastLogin).length,
    loggedIn7d: rows.filter(r => r.lastLogin && Date.now() - r.lastLogin < 7 * 864e5).length,
  }
  // فاز ۲۹۶د — وضعیتِ پیامک‌های سایت‌ساز: ناموفقِ قطعی + نمونهٔ خطا (تا علت در پنل دیده شود).
  const smsSt = await smsStatus()
  return NextResponse.json({ rows, totals: { ...totals, smsFailed: smsSt.failed, smsWaiting: smsSt.waiting, smsSampleErr: smsSt.sampleErr } }, { headers: { 'Cache-Control': 'no-store, private' } })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  if (b.action === 'resetSms') {
    const n = await resetFailedSms()
    return NextResponse.json({ ok: true, reset: n })
  }
  return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
}
