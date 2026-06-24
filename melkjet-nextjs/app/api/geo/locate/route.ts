import { NextRequest, NextResponse } from 'next/server'
import { reverseGeocode } from '@/app/lib/nearby'

// مختصاتِ کاربر → شهر/محله (Neshan reverse). کلاینت بعد از گرفتنِ موقعیت صدا می‌زند.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const lat = parseFloat(sp.get('lat') || '')
  const lng = parseFloat(sp.get('lng') || '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: 'مختصات نامعتبر' }, { status: 400 })
  const r = await reverseGeocode(lat, lng)
  return NextResponse.json({ ok: true, lat, lng, city: r?.city || '', neighborhood: r?.neighborhood || '', address: r?.address || '' }, { headers: { 'Cache-Control': 'no-store' } })
}
