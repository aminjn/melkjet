import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  getAll, addProvince, addCity, addDistrict, addNeighborhood, addNeighborhoodsBulk,
  renameNode, deleteNode,
} from '@/app/lib/geo-store'
import { liveGeo, invalidateLiveGeo } from '@/app/lib/geo-live'
import { invalidateLocations } from '@/app/lib/locations-store'
import { getCities as divarCities, getDistricts as divarDistricts } from '@/app/lib/divar-places'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ provinces: getAll() })
}

// POST { action, ...payload }
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json()
  const name = b.name ? String(b.name).slice(0, 60).trim() : ''
  // تکمیلِ خودکارِ محله‌ها از آگهی‌های واقعی: هر جفتِ «شهر، محله» با ≥۲ آگهی، اگر در درخت نبود،
  // به منطقهٔ «سایر محله‌ها»ی همان شهر اضافه می‌شود. شهرهای ناشناخته گزارش می‌شوند (ساخته نمی‌شوند —
  // چون جای استانشان معلوم نیست؛ ادمین خودش شهر را می‌سازد و دوباره اجرا می‌کند).
  if (b.action === 'enrichFromListings') {
    invalidateLiveGeo()
    const live = await liveGeo()
    const known = new Set(getAll().flatMap(p => p.cities.map(c => c.name.trim())))
    let added = 0
    const perCity: Array<{ city: string; added: number }> = []
    const unknown: Array<{ city: string; hoods: number }> = []
    for (const [city, hoods] of live.hoodsByCity.entries()) {
      const list = [...hoods.entries()].filter(([, n]) => n >= 2).map(([h]) => h)
      if (!list.length) continue
      if (!known.has(city)) { unknown.push({ city, hoods: list.length }); continue }
      const r = addNeighborhoodsBulk(city, list)
      if (r.added > 0) { added += r.added; perCity.push({ city, added: r.added }) }
    }
    invalidateLocations()
    return NextResponse.json({ ok: true, added, perCity: perCity.sort((a, x) => x.added - a.added), unknown: unknown.sort((a, x) => x.hoods - a.hoods), provinces: getAll() })
  }
  // همگام‌سازیِ محلاتِ رسمیِ دیوار به درختِ geo — کامل‌ترین منبعِ محلاتِ کلِ ایران.
  // پیش‌نیاز: ادمین در «منابع داده → دیوار» شهرها/محلات را ایمپورت کرده باشد (دکمهٔ «دریافت همه»).
  if (b.action === 'enrichFromDivar') {
    const norm = (s: string) => String(s || '').replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
    const cities = divarCities()
    if (!cities.length) return NextResponse.json({ error: 'اول از «منابع داده → دیوار» شهرها و محلات را دریافت کن (دکمهٔ دریافت/واردکردنِ همه)' }, { status: 400 })
    const provs = getAll()
    const provByName = new Map(provs.map(p => [norm(p.name), p.id] as const))
    const knownCities = new Set(provs.flatMap(p => p.cities.map(c => norm(c.name))))
    let added = 0, createdCities = 0
    const perCity: Array<{ city: string; added: number }> = []
    const unknown: Array<{ city: string; hoods: number }> = []
    for (const c of cities) {
      const hoods = divarDistricts(c.id).map(d => String(d.name || '').trim()).filter(Boolean)
      if (!hoods.length) continue
      if (!knownCities.has(norm(c.name))) {
        // اگر دیوار استان را داده و آن استان در درخت هست، شهر خودکار ساخته می‌شود؛ وگرنه گزارش.
        const pid = c.province ? provByName.get(norm(c.province)) : undefined
        if (!pid) { unknown.push({ city: c.name, hoods: hoods.length }); continue }
        addCity(pid, c.name)
        knownCities.add(norm(c.name))
        createdCities++
      }
      const r = addNeighborhoodsBulk(c.name, hoods)
      if (r.added > 0) { added += r.added; perCity.push({ city: c.name, added: r.added }) }
    }
    invalidateLocations(); invalidateLiveGeo()
    return NextResponse.json({ ok: true, added, createdCities, perCity: perCity.sort((a, x) => x.added - a.added), unknown: unknown.sort((a, x) => x.hoods - a.hoods), provinces: getAll() })
  }
  let provinces
  switch (b.action) {
    case 'addProvince': if (!name) return bad(); provinces = addProvince(name); break
    case 'addCity': if (!name || !b.pid) return bad(); provinces = addCity(b.pid, name); break
    case 'addDistrict': if (!name || !b.pid || !b.cid) return bad(); provinces = addDistrict(b.pid, b.cid, name); break
    case 'addNeighborhood': if (!name || !b.pid || !b.cid || !b.did) return bad(); provinces = addNeighborhood(b.pid, b.cid, b.did, name); break
    case 'rename': if (!name || !b.level || !b.pid) return bad(); provinces = renameNode(b.level, { pid: b.pid, cid: b.cid, did: b.did }, name); break
    case 'delete': if (!b.level || !b.pid) return bad(); provinces = deleteNode(b.level, { pid: b.pid, cid: b.cid, did: b.did, name: b.name }); break
    default: return bad()
  }
  return NextResponse.json({ ok: true, provinces })
}

function bad() { return NextResponse.json({ error: 'ورودی نامعتبر' }, { status: 400 }) }
