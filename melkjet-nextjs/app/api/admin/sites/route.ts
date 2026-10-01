import { NextResponse } from 'next/server'
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
  }
  return NextResponse.json({ rows, totals }, { headers: { 'Cache-Control': 'no-store, private' } })
}
