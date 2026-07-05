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

function build(): LocationNode[] {
  const provinces = getAll()
  const roots: LocationNode[] = []
  for (const p of provinces) {
    const provSlug = slugify(p.name)
    const cityTaken = new Set<string>()
    const cities: LocationNode[] = []
    for (const c of p.cities || []) {
      const citySlug = uniqueSlug(slugify(c.name), cityTaken); cityTaken.add(citySlug)
      const distTaken = new Set<string>()
      const districts: LocationNode[] = []
      for (const d of c.districts || []) {
        const distSlug = uniqueSlug(slugify(d.name), distTaken); distTaken.add(distSlug)
        const hoodTaken = new Set<string>()
        const hoods: LocationNode[] = []
        for (const h of d.neighborhoods || []) {
          const hs = uniqueSlug(slugify(h), hoodTaken); hoodTaken.add(hs)
          hoods.push({ type: 'neighborhood', slug: hs, nameFa: h, path: [citySlug, distSlug, hs], children: [] })
        }
        districts.push({ type: 'district', slug: distSlug, nameFa: d.name, path: [citySlug, distSlug], children: hoods })
      }
      cities.push({ type: 'city', slug: citySlug, nameFa: c.name, path: [citySlug], children: districts })
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
