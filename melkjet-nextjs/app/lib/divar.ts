import type { Source, Item } from './scraper-store'
import { getAdminData } from './admin-store'
import { proxiedRequest } from './proxy-fetch'
import { getDistricts } from './divar-places'

type RawItem = Omit<Item, 'id' | 'sourceId' | 'sourceName' | 'type' | 'category' | 'meta' | 'scrapedAt' | 'status'>

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ENDPOINT = 'https://api.divar.ir/v8/postlist/w/search'

// normalize Persian names for matching (drop ZWNJ + all spaces)
function norm(s: string): string {
  return (s || '').replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
}

// Divar web city slug → numeric city_id
const CITY_SLUG: Record<string, string> = {
  tehran: '1', karaj: '2', mashhad: '4', tabriz: '5',
  isfahan: '6', esfahan: '6', shiraz: '7', ahvaz: '8', qom: '9',
}
// Divar web category slug (deal-type) → API category value (type-deal)
const CAT_SLUG: Record<string, string> = {
  'rent-apartment': 'apartment-rent', 'buy-apartment': 'apartment-sell',
  'rent-villa': 'house-villa-rent', 'buy-villa': 'house-villa-sell',
  'rent-house': 'house-villa-rent', 'buy-house': 'house-villa-sell',
  'rent-residential': 'residential-rent', 'buy-residential': 'residential-sell',
  'rent-office': 'office-rent', 'buy-office': 'office-sell',
  'rent-shop': 'store-rent', 'buy-shop': 'store-sell',
}

// Pull city_id / category / district out of a pasted Divar URL.
// Map-view URLs carry map_place_hash = "cityId|districtId|category" (e.g. "1|992|apartment-rent").
function parseDivarUrl(url: string): { cityId?: string; category?: string; district?: string } {
  try {
    const u = new URL(url)
    if (!/divar\.ir$/i.test(u.hostname)) return {}
    const out: { cityId?: string; category?: string; district?: string } = {}

    const placeHash = u.searchParams.get('map_place_hash') || u.searchParams.get('place_hash')
    if (placeHash) {
      const [c, dist, cat] = placeHash.split('|')
      if (c) out.cityId = c
      if (dist) out.district = dist
      if (cat) out.category = cat
    }

    const parts = u.pathname.split('/').filter(Boolean) // ['s','tehran','rent-apartment','abshar']
    if (parts[0] === 's') {
      if (!out.cityId && parts[1]) out.cityId = CITY_SLUG[parts[1].toLowerCase()]
      if (!out.category && parts[2]) out.category = CAT_SLUG[parts[2].toLowerCase()] || parts[2]
    }
    return out
  } catch { return {} }
}

function mapRow(w: any): RawItem {
  const data = w.data || {}
  const payload = data.action?.payload || {}
  const wi = payload.web_info || {}
  const token = payload.token
  // bottom_description_text is usually "<آژانس/شخص> در <محله>" → owner = before " در "
  const bottom = data.bottom_description_text || ''
  const owner = bottom.includes(' در ') ? bottom.split(' در ')[0].trim() : undefined
  return {
    title: data.title || '',
    price: data.top_description_text || data.middle_description_text || undefined,
    location: [wi.district_persian, wi.city_persian].filter(Boolean).join('، ') || undefined,
    image: data.image_url || undefined,
    url: token ? `https://divar.ir/v/${token}` : undefined,
    excerpt: [data.middle_description_text, data.bottom_description_text].filter(Boolean).join(' · ') || undefined,
    owner,
  }
}

/** Scrape Divar listings via the official web search API (JSON, through proxy).
 *  Supports pagination and optional client-side neighbourhood filtering. */
/** Scrape Divar listings via the official web search API (JSON, through proxy).
 *  - If a district id is available (from a map URL's place_hash), Divar filters
 *    server-side → all listings of that neighbourhood.
 *  - Otherwise: city+category, optionally client-filtered by محله name. */
export async function scrapeDivar(source: Source): Promise<RawItem[]> {
  const fromUrl = parseDivarUrl(source.url || '')
  // Dropdown selections (meta) win over the URL; URL is the fallback.
  const cityId = source.meta?.['city_id'] || fromUrl.cityId || '1'
  const category = source.meta?.['category'] || fromUrl.category || 'apartment-rent'
  const district = source.meta?.['district_id'] || fromUrl.district || ''
  const wantHood = district ? '' : norm(source.meta?.['محله'] || '')   // server-side district makes name-filter unnecessary

  // centroid of the district → bbox (so Divar returns the whole neighbourhood, not just near the center)
  let bbox: { min_latitude: number; min_longitude: number; max_latitude: number; max_longitude: number } | undefined
  if (district) {
    let lat = parseFloat(source.meta?.['lat'] || ''), lng = parseFloat(source.meta?.['lng'] || '')
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      const d = getDistricts(cityId).find(x => String(x.id) === String(district))
      if (d?.lat && d?.lng) { lat = d.lat; lng = d.lng }
    }
    if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat && lng) {
      bbox = { min_latitude: lat - 0.04, min_longitude: lng - 0.035, max_latitude: lat + 0.04, max_longitude: lng + 0.035 }
    }
  }

  const proxyUrl = getAdminData().divar?.proxyUrl || 'http://127.0.0.1:1080'
    || process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || undefined

  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/plain, */*',
    'user-agent': UA,
    origin: 'https://divar.ir',
    referer: 'https://divar.ir/',
    'x-standard-divar-error': 'true',
    'x-render-type': 'CSR',
    'x-screen-size': '1280x720',
  }

  const buildBody = (pagination: any): string => {
    const data: any = { category: { str: { value: category } } }
    const body: any = {
      city_ids: [String(cityId)],
      disable_recommendation: false,
      search_data: {
        form_data: { data },
        server_payload: {
          '@type': 'type.googleapis.com/widgets.SearchData.ServerPayload',
          additional_form_data: { data: { sort: { str: { value: 'sort_date' } } } },
        },
      },
    }
    if (district) {
      data.districts = { repeated_string: { value: [String(district)] } }
      body.source_view = 'MAP_DISCOVERY_MAP'
      const cam: any = { place_hash: `${cityId}|${district}|${category}`, zoom: 13 }
      if (bbox) cam.bbox = bbox
      body.map_state = { camera_info: cam, page_state: 'FULL_MAP' }
      body.current_tab_slug = 'default'
      body.previous_place_ids = []
    }
    if (pagination) body.pagination_data = pagination
    return JSON.stringify(body)
  }

  const maxPages = (district || wantHood) ? 20 : 2
  const targetCount = 300
  let pagination: any = null
  const collected: RawItem[] = []

  for (let page = 0; page < maxPages; page++) {
    const res = await proxiedRequest(ENDPOINT, { method: 'POST', headers, body: buildBody(pagination), proxyUrl, timeout: 20000 })
    if (res.status !== 200) { if (page === 0) throw new Error(`Divar HTTP ${res.status}`); break }

    let d: any
    try { d = JSON.parse(res.body) } catch { throw new Error('پاسخ دیوار قابل خواندن نبود') }

    const widgets: any[] = d.list_widgets || d.widget_list || []
    const rows = widgets.filter((w) => w.widget_type === 'POST_ROW')
    if (!rows.length && page === 0 && widgets.some((w) => w.widget_type === 'BLOCKING_VIEW')) {
      throw new Error('دیوار درخواست را بلاک کرد (BLOCKING_VIEW) — پروکسی/هدر را بررسی کنید')
    }

    for (const w of rows) {
      const item = mapRow(w)
      if (!item.title) continue
      if (wantHood) {
        const dh = norm(w.data?.action?.payload?.web_info?.district_persian || '')
        if (!dh || !(dh === wantHood || dh.includes(wantHood) || wantHood.includes(dh))) continue
      }
      collected.push(item)
    }

    if (collected.length >= targetCount) break
    if (!d.pagination?.has_next_page || !d.pagination?.data) break
    pagination = d.pagination.data
  }

  const seen = new Set<string>()
  return collected.filter((i) => { const k = i.url || i.title; if (seen.has(k)) return false; seen.add(k); return true })
}

