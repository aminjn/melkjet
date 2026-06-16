import type { Source, Item } from './scraper-store'
import { getAdminData } from './admin-store'
import { proxiedRequest } from './proxy-fetch'

type RawItem = Omit<Item, 'id' | 'sourceId' | 'sourceName' | 'type' | 'category' | 'meta' | 'scrapedAt' | 'status'>

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ENDPOINT = 'https://api.divar.ir/v8/postlist/w/search'

/** Scrape Divar listings via the official web search API (JSON, through proxy). */
export async function scrapeDivar(source: Source): Promise<RawItem[]> {
  const cityId = source.meta?.['city_id'] || '1'
  const category = source.meta?.['category'] || 'apartment-rent'
  const proxyUrl = getAdminData().divar?.proxyUrl
    || process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || undefined

  const body = JSON.stringify({
    city_ids: [String(cityId)],
    search_data: { form_data: { data: { category: { str: { value: category } } } } },
  })

  const res = await proxiedRequest(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA, accept: 'application/json' },
    body,
    proxyUrl,
    timeout: 20000,
  })
  if (res.status !== 200) throw new Error(`Divar HTTP ${res.status}`)

  let d: any
  try { d = JSON.parse(res.body) } catch { throw new Error('پاسخ دیوار قابل خواندن نبود') }

  // blocking / update-app responses contain no real posts
  const widgets: any[] = d.list_widgets || d.widget_list || []
  const rows = widgets.filter((w) => w.widget_type === 'POST_ROW')
  if (!rows.length && widgets.some((w) => w.widget_type === 'BLOCKING_VIEW')) {
    throw new Error('دیوار درخواست را بلاک کرد (BLOCKING_VIEW)')
  }

  return rows.map((w): RawItem => {
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
  }).filter((x) => x.title)
}
