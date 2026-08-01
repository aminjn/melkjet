import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

// فاز ۲۳۴ — تنظیماتِ سامانهٔ نقشهٔ اختصاصی (جایگزینِ نشان): baseUrl + apiKey + تستِ زنده.
export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const g = getAdminData().geoApi || {}
  const { geoTileVersion } = await import('@/app/lib/geo-api')
  return NextResponse.json({
    baseUrl: g.baseUrl || '',
    configured: !!g.baseUrl,
    keyMasked: g.apiKey ? '***' + String(g.apiKey).slice(-4) : '',
    tileV: geoTileVersion(),
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const body = await req.json().catch(() => ({} as any))

  if (body.action === 'test') {
    // تستِ زنده با «کدِ وضعیتِ» هر سرویس — تا ریشهٔ خطا دیده شود (۴۰۱=کلید، ۴۰۴=مسیر، ۰=شبکه/تایم‌اوت).
    const { geoDebugProbe, geoApiEnabled, geoApiCfg } = await import('@/app/lib/geo-api')
    if (!geoApiEnabled()) return NextResponse.json({ ok: false, error: 'اول baseUrl را ذخیره کنید' })
    const probes = await geoDebugProbe()
    const ok = probes.some(p => p.status === 200)
    const line = probes.map(p => `${p.name}: ${p.status === 200 ? '✓' : `✗ (${p.status || 'شبکه'})`}`).join(' · ')
    return NextResponse.json({ ok, line, baseUrl: geoApiCfg().baseUrl, probes })
  }

  if (body.action === 'bump-tiles') {
    // فاز ۲۴۹ — «گرافیکِ نقشه را در سامانه عوض کردم ولی جاهایی قدیمی مانده»: بامپِ نسخهٔ کاشی
    // هم‌زمان کشِ nginxِ سامانه (mv)، Redisِ ما (کلیدِ tile:N) و مرورگرِ کاربران (?v=N) را نو می‌کند.
    const { geoTileVersion } = await import('@/app/lib/geo-api')
    const data = getAdminData()
    const next = geoTileVersion() + 1
    data.geoApi = { ...(data.geoApi || {}), tileV: next }
    saveAdminData(data)
    return NextResponse.json({ ok: true, tileV: next })
  }

  const data = getAdminData()
  const cur = data.geoApi || {}
  // آسان‌گیر: «nexamap.ir» یا «nexamap.ir/v1» هم قبول است — خودمان https:// و حذفِ /v1 و / انتهایی را درست می‌کنیم.
  let baseUrl = body.baseUrl !== undefined ? String(body.baseUrl).trim() : (cur.baseUrl || '')
  if (baseUrl) {
    if (!/^https?:\/\//i.test(baseUrl)) baseUrl = 'https://' + baseUrl
    baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
  }
  const apiKey = body.apiKey !== undefined ? String(body.apiKey).trim() : (cur.apiKey || '')
  data.geoApi = { ...cur, baseUrl, apiKey }   // فاز ۲۴۹: tileV و فیلدهای آینده نباید با ذخیرهٔ آدرس/کلید گم شوند
  saveAdminData(data)
  return NextResponse.json({ ok: true, configured: !!baseUrl })
}
