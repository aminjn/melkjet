import { getAll } from './geo-store'
import { slugify, uniqueSlug } from './slugify'

// ── Location Engine — درختِ مکانِ اسلاگ‌دار (province→city→district→neighborhood) ──
// از geo-store مشتق می‌شود و slugِ انگلیسیِ یکتا زیرِ هر والد می‌سازد. قلبِ Programmatic SEO.
export type LocationType = 'province' | 'city' | 'district' | 'neighborhood'
export interface LocationNode {
  type: LocationType
  slug: string
  nameFa: string
  path: string[]          // مسیرِ اسلاگ از city به پایین (برای URL)، مثلاً ['tehran','district-2','saadat-abad']
  children: LocationNode[]
}

// کشِ سبک — درخت از فایلِ geo (کم‌تغییر) ساخته می‌شود.
let cache: { at: number; roots: LocationNode[] } | null = null
const TTL = 30_000

// نامِ نرمال‌شده (نیم‌فاصله→فاصله، فشرده) — برای تشخیصِ «هم‌نامیِ محله با منطقهٔ والد».
const nrm = (s: string) => String(s || '').replace(/‌/g, ' ').replace(/\s+/g, ' ').trim()

function build(): LocationNode[] {
  const provinces = getAll()
  const roots: LocationNode[] = []
  // فاز ۲۵۳ (بی‌شکافِ ساختاری): URLِ مکان «شهرمحور» است (/locations/{city}/…)، پس اسلاگِ شهر باید
  // «سراسری» یکتا باشد نه فقط داخلِ استان — وگرنه شهرِ هم‌نام/هم‌اسلاگ در دو استان یک URL می‌سازد.
  const cityTaken = new Set<string>()                                   // اسلاگِ شهر سراسری یکتا
  const cityByName = new Map<string, LocationNode>()                    // nrm(نامِ شهر) → گرهٔ شهر (برای ادغامِ هم‌نام‌ها)
  const distTakenOf = new Map<string, Set<string>>()                   // citySlug → مجموعهٔ اسلاگِ مناطق
  const distByNameOf = new Map<string, Map<string, LocationNode>>()    // citySlug → (nrm(نامِ منطقه) → گرهٔ منطقه)
  for (const p of provinces) {
    const provSlug = slugify(p.name)
    const cities: LocationNode[] = []
    for (const c of p.cities || []) {
      // شهرِ هم‌نام که قبلاً در استانِ دیگری آمده (مثلِ «کرج» در تهران و البرز) = همان شهرِ واقعی →
      // مناطق/محله‌هایش را در «همان» گره ادغام می‌کنیم (اتحاد، بدونِ گم‌شدنِ داده و بدونِ URLِ تکراری).
      const cKey = nrm(c.name)
      let city = cityByName.get(cKey)
      if (!city) {
        const citySlug = uniqueSlug(slugify(c.name), cityTaken); cityTaken.add(citySlug)
        city = { type: 'city', slug: citySlug, nameFa: c.name, path: [citySlug], children: [] }
        cityByName.set(cKey, city)
        distTakenOf.set(citySlug, new Set<string>([citySlug]))   // منطقه هرگز اسلاگِ شهر را نگیرد → x/x غیرممکن
        distByNameOf.set(citySlug, new Map())
        cities.push(city)   // شهر فقط بارِ اول (در استانِ خودش) در فهرستِ استان می‌آید
      }
      const citySlug = city.slug
      const distTaken = distTakenOf.get(citySlug)!
      const distByName = distByNameOf.get(citySlug)!
      for (const d of c.districts || []) {
        const dKey = nrm(d.name)
        let dist = distByName.get(dKey)
        if (!dist) {
          const distSlug = uniqueSlug(slugify(d.name), distTaken); distTaken.add(distSlug)
          dist = { type: 'district', slug: distSlug, nameFa: d.name, path: [citySlug, distSlug], children: [] }
          distByName.set(dKey, dist)
          city.children.push(dist)
        }
        const distSlug = dist.slug
        // محله هرگز اسلاگِ منطقه را نگیرد → x/y/y غیرممکن؛ اسلاگِ متصادف پسوندِ یکتا می‌گیرد (حذف نمی‌شود).
        const hoodTaken = new Set<string>([distSlug, ...dist.children.map(h => h.slug)])
        const hoodNames = new Set<string>(dist.children.map(h => nrm(h.nameFa)))
        for (const h of d.neighborhoods || []) {
          if (nrm(h) === nrm(d.name)) continue   // محلهٔ هم‌نامِ منطقه = محتوای همسانِ صفحهٔ منطقه → حذف
          if (hoodNames.has(nrm(h))) continue     // محلهٔ تکراری (در ادغامِ شهرِ هم‌نام) → یک‌بار
          hoodNames.add(nrm(h))
          const hs = uniqueSlug(slugify(h), hoodTaken); hoodTaken.add(hs)
          dist.children.push({ type: 'neighborhood', slug: hs, nameFa: h, path: [citySlug, distSlug, hs], children: [] })
        }
      }
    }
    roots.push({ type: 'province', slug: provSlug, nameFa: p.name, path: [provSlug], children: cities })
  }
  return roots
}

export function locationTree(): LocationNode[] {
  if (cache && Date.now() - cache.at < TTL) return cache.roots
  const roots = build(); cache = { at: Date.now(), roots }; return roots
}
export function invalidateLocations() { cache = null }

// یافتنِ گرهٔ مکان با مسیرِ اسلاگ (از سطحِ city). طول ۱=city، ۲=district، ۳=neighborhood.
export function resolveLocationPath(slugs: string[]): { node: LocationNode; trail: LocationNode[] } | null {
  const clean = slugs.filter(Boolean)
  if (clean.length === 0) return null
  for (const prov of locationTree()) {
    const city = prov.children.find(c => c.slug === clean[0])
    if (!city) continue
    const trail: LocationNode[] = [city]
    let node: LocationNode = city
    for (let i = 1; i < clean.length; i++) {
      const next = node.children.find(x => x.slug === clean[i])
      if (!next) return null
      trail.push(next); node = next
    }
    return { node, trail }
  }
  return null
}

// همهٔ محله‌ها به‌صورتِ تخت (برای انتخابگر/Programmatic). شاملِ مسیرِ اسلاگ و نامِ شهر/منطقه.
export function flatNeighborhoods(): { nameFa: string; slug: string; citySlug: string; cityFa: string; districtSlug: string; districtFa: string; path: string[] }[] {
  const out: { nameFa: string; slug: string; citySlug: string; cityFa: string; districtSlug: string; districtFa: string; path: string[] }[] = []
  for (const prov of locationTree()) for (const city of prov.children) for (const dist of city.children) for (const h of dist.children) {
    out.push({ nameFa: h.nameFa, slug: h.slug, citySlug: city.slug, cityFa: city.nameFa, districtSlug: dist.slug, districtFa: dist.nameFa, path: h.path })
  }
  return out
}

// slugِ یک نامِ محله (برای ساختِ URL از دادهٔ متنیِ آگهی/پروموت).
export function slugForNeighborhood(nameFa: string): string | null {
  const want = String(nameFa || '').trim()
  if (!want) return null
  const hit = flatNeighborhoods().find(n => n.nameFa === want)
  return hit ? hit.slug : slugify(want) || null
}
