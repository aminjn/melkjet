import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'
import { stats, recentVisitors, visitsOfPhone } from '@/app/lib/tracker-store'
import { listLinks, linkStats, applyStats } from '@/app/lib/tracker-links-store'
import { getNxalStats } from '@/app/lib/shortener'

export const runtime = 'nodejs'
export const maxDuration = 120

const DEFAULT_TEMPLATE = 'سلام👋 «%title%» را در ملک‌جت دیدید و مشتاقانه منتظرِ شما هستیم. برای پیگیری همین حالا اقدام کنید: %url%'

export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  // فاز ۸۸: تاریخچهٔ بازدیدِ یک کاربرِ مشخص (برای کشوی کاربر) — ?phone=...
  const phoneQ = new URL(req.url).searchParams.get('phone')
  if (phoneQ) return NextResponse.json({ ok: true, visits: await visitsOfPhone(String(phoneQ)) }, { headers: { 'Cache-Control': 'no-store' } })
  // با ?refresh=1 آمارِ کلیکِ لینک‌ها از nxal به‌روزرسانی می‌شود.
  if (new URL(req.url).searchParams.get('refresh') === '1') {
    for (const l of await listLinks(60)) {
      if (!l.linkId) continue
      const st = await getNxalStats(l.linkId)
      if (st) await applyStats(l.code, st)
    }
  }
  const d = getAdminData()
  const t = d.tracker || {}
  const sh = d.shortener
  return NextResponse.json({
    enabled: !!t.enabled,
    template: t.template || DEFAULT_TEMPLATE,
    pattern: t.pattern || '',
    patternVar: t.patternVar || 'message',
    delayMin: t.delayMin ?? 2,
    throttleHours: t.throttleHours ?? 6,
    paths: t.paths || '',
    stats: await stats(),
    visitors: await (async () => {   // فاز ۸۸/۹۱: چه کسی کجا رفت — یک ردیف per کاربر + نامِ حساب
      const vs = await recentVisitors(60)
      try {
        const { listAccounts } = await import('@/app/lib/account-store')
        const nameOf = new Map(listAccounts().map((a: any) => [a.phone, a.name || '']))
        return vs.map(v => ({ ...v, name: v.phone ? (nameOf.get(v.phone) || '') : '' }))
      } catch { return vs }
    })(),
    shortener: { configured: !!sh?.apiKey, masked: sh?.apiKey ? '***' + sh.apiKey.slice(-4) : '', siteBase: sh?.siteBase || 'https://melkjet.com', domain: sh?.domain || '' },
    links: await listLinks(100),
    linkStats: await linkStats(),
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const data = getAdminData()
  const cur = data.tracker || {}
  data.tracker = {
    enabled: b.enabled !== undefined ? !!b.enabled : !!cur.enabled,
    template: b.template !== undefined ? String(b.template) : (cur.template || DEFAULT_TEMPLATE),
    pattern: b.pattern !== undefined ? String(b.pattern).trim() : (cur.pattern || ''),
    patternVar: (b.patternVar ? String(b.patternVar) : (cur.patternVar || 'message')).trim() || 'message',
    delayMin: b.delayMin !== undefined ? Math.max(0, Math.round(Number(b.delayMin) || 0)) : (cur.delayMin ?? 2),
    throttleHours: b.throttleHours !== undefined ? Math.max(0, Math.round(Number(b.throttleHours) || 0)) : (cur.throttleHours ?? 6),
    paths: b.paths !== undefined ? String(b.paths) : (cur.paths || ''),
  }
  // تنظیماتِ کوتاه‌کنندهٔ لینک (nxal)
  if (b.shortenerKey !== undefined || b.siteBase !== undefined || b.shortenerDomain !== undefined) {
    const shCur = data.shortener || { apiKey: '' }
    data.shortener = {
      apiKey: (b.shortenerKey && !String(b.shortenerKey).startsWith('***')) ? String(b.shortenerKey).trim() : shCur.apiKey,
      baseUrl: shCur.baseUrl,
      domain: b.shortenerDomain !== undefined ? String(b.shortenerDomain).trim() : shCur.domain,
      siteBase: b.siteBase !== undefined ? String(b.siteBase).trim() : shCur.siteBase,
    }
  }
  saveAdminData(data)
  return NextResponse.json({ ok: true })
}
