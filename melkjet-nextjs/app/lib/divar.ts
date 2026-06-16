import type { Source, Item } from './scraper-store'
import { getAdminData } from './admin-store'
import { proxiedRequest } from './proxy-fetch'

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

// Pull city_id / category / neighbourhood out of a pasted Divar URL.
function parseDivarUrl(url: string): { cityId?: string; category?: string } {
  try {
    const u = new URL(url)
    if (!/divar\.ir$/i.test(u.hostname)) return {}
    const parts = u.pathname.split('/').filter(Boolean) // ['s','tehran','rent-apartment','abshar']
    if (parts[0] !== 's') return {}
    const out: { cityId?: string; category?: string } = {}
    if (parts[1]) out.cityId = CITY_SLUG[parts[1].toLowerCase()]
    if (parts[2]) out.category = CAT_SLUG[parts[2].toLowerCase()] || parts[2]
    return out
  } catch { return {} }
}

function mapRow(w: any): RawItem {
  const data = w.data || {}
  const payload = data.action?.payload || {}
  const wi = payload.web_info || {}
  const token = payload.token
  return {
    title: data.title || '',
    price: data.top_description_text || data.middle_description_text || undefined,
    location: [wi.district_persian, wi.city_persian].filter(Boolean).join('، ') || undefined,
    image: data.image_url || undefined,
    url: token ? `https://divar.ir/v/${token}` : undefined,
    excerpt: [data.middle_description_text, data.bottom_description_text].filter(Boolean).join(' · ') || undefined,
  }
}

/** Scrape Divar listings via the official web search API (JSON, through proxy).
 *  Supports pagination and optional client-side neighbourhood filtering. */
export async function scrapeDivar(source: Source): Promise<RawItem[]> {
  // A pasted Divar URL overrides the city/category dropdowns
  const fromUrl = parseDivarUrl(source.url || '')
  const cityId = fromUrl.cityId || source.meta?.['city_id'] || '1'
  const category = fromUrl.category || source.meta?.['category'] || 'apartment-rent'
  const wantHood = norm(source.meta?.['محله'] || '')
  const proxyUrl = getAdminData().divar?.proxyUrl
    || process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || undefined

  const searchData = { form_data: { data: { category: { str: { value: category } } } } }
  const headers = { 'content-type': 'application/json', 'user-agent': UA, accept: 'application/json' }

  const maxPages = wantHood ? 6 : 2          // dig deeper when filtering by a neighbourhood
  const targetCount = 60
  let pagination: any = null
  const collected: RawItem[] = []

  for (let page = 0; page < maxPages; page++) {
    const body: any = { city_ids: [String(cityId)], search_data: searchData }
    if (pagination) body.pagination_data = pagination

    const res = await proxiedRequest(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body), proxyUrl, timeout: 20000 })
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

  // dedup by url/title
  const seen = new Set<string>()
  return collected.filter((i) => { const k = i.url || i.title; if (seen.has(k)) return false; seen.add(k); return true })
}

