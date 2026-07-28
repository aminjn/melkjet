import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAdminData, saveAdminData } from '@/app/lib/admin-store'

// فاز ۲۳۴ — تنظیماتِ سامانهٔ نقشهٔ اختصاصی (جایگزینِ نشان): baseUrl + apiKey + تستِ زنده.
export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const g = getAdminData().geoApi || {}
  return NextResponse.json({
    baseUrl: g.baseUrl || '',
    configured: !!g.baseUrl,
    keyMasked: g.apiKey ? '***' + String(g.apiKey).slice(-4) : '',
  })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const body = await req.json().catch(() => ({} as any))

  if (body.action === 'test') {
    // تستِ زنده: geocode و reverse و search — خروجی سند است، نه ادعا.
    const { geoGeocode, geoReverse, geoSearch, geoApiEnabled } = await import('@/app/lib/geo-api')
    if (!geoApiEnabled()) return NextResponse.json({ ok: false, error: 'اول baseUrl را ذخیره کنید' })
    const [g, r, sr] = await Promise.all([
      geoGeocode('تهران ونک').catch(() => null),
      geoReverse(35.7575, 51.41).catch(() => null),
      geoSearch('', { lat: 35.7575, lng: 51.41, radius: 1000, limit: 3 }).catch(() => [] as unknown[]),
    ])
    return NextResponse.json({
      ok: !!(g || r),
      geocode: g ? `✓ (${g.lat.toFixed(3)},${g.lng.toFixed(3)})` : '✗',
      reverse: r ? `✓ ${r.city || r.address || ''}` : '✗',
      search: Array.isArray(sr) ? `✓ ${sr.length} نتیجه` : '✗',
    })
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
  data.geoApi = { baseUrl, apiKey }
  saveAdminData(data)
  return NextResponse.json({ ok: true, configured: !!baseUrl })
}
