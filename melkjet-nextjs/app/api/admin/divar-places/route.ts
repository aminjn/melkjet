import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getCities, getDistricts, placesSummary, importCities, importDistricts } from '@/app/lib/divar-places'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

// GET            → summary + cities
// GET ?cityId=   → districts of a city
export async function GET(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const cityId = new URL(req.url).searchParams.get('cityId')
  if (cityId) return NextResponse.json({ districts: getDistricts(cityId) })
  return NextResponse.json({ summary: placesSummary(), cities: getCities() })
}

// POST { action:'cities' }            → import the cities list
// POST { action:'districts', cityId } → import one city's districts
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  try {
    if (b.action === 'cities') return NextResponse.json({ ok: true, ...(await importCities()) })
    if (b.action === 'districts' && b.cityId) return NextResponse.json({ ok: true, ...(await importDistricts(b.cityId)) })
    return NextResponse.json({ error: 'ورودی نامعتبر' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در دریافت از دیوار' }, { status: 200 })
  }
}
