import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  getAll, addProvince, addCity, addDistrict, addNeighborhood, addNeighborhoodsBulk,
  renameNode, deleteNode, pruneGenericNeighborhoods,
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
  // حذفِ محله‌های کلی وقتی نسخهٔ مشخص‌ترشان هست (جنت‌آباد → شمالی/جنوبی/مرکزی) — «محلهٔ کلی نباید بماند».
  if (b.action === 'pruneGeneric') {
    const r = pruneGenericNeighborhoods()
    invalidateLiveGeo()
    invalidateLocations()
    return NextResponse.json({ ok: true, removed: r.removed, samples: r.samples, provinces: getAll() })
  }
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
    // استانِ شهرهای اقماری/شناخته‌شده‌ای که پاسخِ دیوار برایشان استان نمی‌دهد (نگاشتِ جغرافیاییِ واقعی).
    const FALLBACK_PROVINCE: Record<string, string> = {
      'شهرری': 'تهران', 'ری': 'تهران', 'قدس': 'تهران', 'اندیشه': 'تهران', 'رباطکریم': 'تهران',
      'قرچک': 'تهران', 'ملارد': 'تهران', 'شهریار': 'تهران', 'اسلامشهر': 'تهران', 'پاکدشت': 'تهران',
      'ورامین': 'تهران', 'پردیس': 'تهران', 'پرند': 'تهران', 'نسیمشهر': 'تهران', 'باقرشهر': 'تهران',
      'لواسان': 'تهران', 'دماوند': 'تهران', 'فیروزکوه': 'تهران', 'بومهن': 'تهران', 'صالحیه': 'تهران',
      'محمدشهر': 'البرز', 'کرج': 'البرز', 'فردیس': 'البرز', 'کمالشهر': 'البرز', 'نظرآباد': 'البرز',
      'هشتگرد': 'البرز', 'ماهدشت': 'البرز', 'مشکیندشت': 'البرز', 'گرمدره': 'البرز',
      'فولادشهر': 'اصفهان', 'خمینیشهر': 'اصفهان', 'شاهینشهر': 'اصفهان', 'نجفآباد': 'اصفهان',
      'بهارستان': 'اصفهان', 'درچه': 'اصفهان', 'شهرضا': 'اصفهان',
      'تربتجام': 'خراسان رضوی', 'تربتحیدریه': 'خراسان رضوی', 'طرقبه': 'خراسان رضوی',
      'شاندیز': 'خراسان رضوی', 'گلبهار': 'خراسان رضوی', 'بینالود': 'خراسان رضوی',
      'صدرا': 'فارس', 'مرودشت': 'فارس', 'کازرون': 'فارس',
      'بندرکنگان': 'بوشهر', 'عسلویه': 'بوشهر',
    }
    let added = 0, createdCities = 0, withHoods = 0, alreadyComplete = 0
    const perCity: Array<{ city: string; added: number }> = []
    const unknown: Array<{ city: string; hoods: number }> = []
    for (const c of cities) {
      const hoods = divarDistricts(c.id).map(d => String(d.name || '').trim()).filter(Boolean)
      if (hoods.length) withHoods++
      if (!knownCities.has(norm(c.name))) {
        // اول استانِ اعلامیِ دیوار (از واردکردنِ درختی)، بعد نگاشتِ ثابتِ شهرهای اقماری؛ وگرنه گزارش.
        // شهرِ بدونِ محله هم ساخته می‌شود — دیوار مثلاً برای مازندران ~۷۰ شهر دارد که اکثرشان محله ندارند.
        const provName = c.province || FALLBACK_PROVINCE[norm(c.name)]
        const pid = provName ? provByName.get(norm(provName)) : undefined
        if (!pid) { if (hoods.length) unknown.push({ city: c.name, hoods: hoods.length }); continue }
        addCity(pid, c.name)
        knownCities.add(norm(c.name))
        createdCities++
      }
      if (!hoods.length) continue
      const r = addNeighborhoodsBulk(c.name, hoods)
      if (r.added > 0) { added += r.added; perCity.push({ city: c.name, added: r.added }) }
      else alreadyComplete++
    }
    invalidateLocations(); invalidateLiveGeo()
    return NextResponse.json({
      ok: true, added, createdCities, withHoods, alreadyComplete,
      perCity: perCity.sort((a, x) => x.added - a.added),
      unknown: unknown.sort((a, x) => x.hoods - a.hoods), provinces: getAll(),
    })
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
