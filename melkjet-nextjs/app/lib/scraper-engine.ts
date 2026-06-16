import type { Source, Item, Method } from './scraper-store'
import { parseHTML, queryAll, queryOne, textOf } from './html-select'
import { scrapeDivar } from './divar'

type RawItem = Omit<Item, 'id' | 'sourceId' | 'sourceName' | 'type' | 'category' | 'scrapedAt' | 'status'>

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

async function fetchPage(url: string): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml,application/rss+xml,*/*' },
      signal: ctrl.signal,
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&zwnj;/g, '‌')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── RSS / Atom feeds (best for articles & news) ──────────────────────────
function parseRSS(xml: string, limit = 30): RawItem[] {
  const out: RawItem[] = []
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || []
  for (const b of blocks.slice(0, limit)) {
    const title = (b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim()
    let link = (b.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || '').trim()
    if (!link) link = b.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] || ''
    const desc = b.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]
      || b.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1]
      || b.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] || ''
    const img = b.match(/<enclosure[^>]*url=["']([^"']+)["']/i)?.[1]
      || b.match(/<media:content[^>]*url=["']([^"']+)["']/i)?.[1]
      || (desc.match(/<img[^>]*src=["']([^"']+)["']/i)?.[1])
    const t = decode(title)
    if (!t) continue
    out.push({ title: t, url: decode(link), excerpt: decode(desc).slice(0, 220), image: img })
  }
  return out
}

// ─── JSON-LD structured data (best for listings & products with price) ────
function parseJsonLd(html: string, limit = 30): RawItem[] {
  const out: RawItem[] = []
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  const collect = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(collect); return }
    const type = (node['@type'] || '').toString().toLowerCase()
    const offers = node.offers || {}
    const price = node.price || offers.price || offers.lowPrice
    const isItem = /product|apartment|house|residence|offer|realestate|singlefamily|listing|article|newsarticle|blogposting|organization|localbusiness|person|store|professionalservice|legalservice|financialservice/.test(type)
    if (isItem && (node.name || node.headline)) {
      const addr = node.address || {}
      const rating = node.aggregateRating?.ratingValue || node.aggregateRating?.ratingValue?.toString()
      const phone = node.telephone || node.contactPoint?.telephone
      out.push({
        title: decode((node.name || node.headline || '').toString()),
        price: price ? `${price}${offers.priceCurrency ? ' ' + offers.priceCurrency : ''}` : undefined,
        location: addr.addressLocality || addr.streetAddress || node.contentLocation?.name || (typeof addr === 'string' ? addr : undefined),
        image: typeof node.image === 'string' ? node.image : (Array.isArray(node.image) ? node.image[0] : node.image?.url),
        url: (node.url || node.mainEntityOfPage?.['@id'] || node.mainEntityOfPage || '').toString() || undefined,
        excerpt: decode((node.description || '').toString()).slice(0, 220) || undefined,
        phone: phone ? phone.toString() : undefined,
        rating: rating ? rating.toString() : undefined,
      })
    }
    // recurse into common containers
    if (node['@graph']) collect(node['@graph'])
    if (node.itemListElement) collect(node.itemListElement)
    if (node.item) collect(node.item)
  }
  for (const blk of blocks) {
    const json = blk.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim()
    try { collect(JSON.parse(json)) } catch {}
    if (out.length >= limit) break
  }
  return out.slice(0, limit)
}

// ─── OpenGraph meta (single-item fallback) ────────────────────────────────
function parseOG(html: string): RawItem[] {
  const meta = (p: string) =>
    html.match(new RegExp(`<meta[^>]*property=["']${p}["'][^>]*content=["']([^"']*)["']`, 'i'))?.[1]
    || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${p}["']`, 'i'))?.[1]
  const title = meta('og:title') || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  if (!title) return []
  return [{
    title: decode(title),
    price: meta('product:price:amount') || meta('og:price:amount'),
    location: meta('og:locality') || meta('business:contact_data:locality'),
    image: meta('og:image'),
    url: meta('og:url'),
    excerpt: decode(meta('og:description') || '').slice(0, 220) || undefined,
  }]
}

// ─── CSS-selector extraction (detailed, user-configured) ──────────────────
function absUrl(href: string, base: string): string {
  try { return new URL(href, base).toString() } catch { return href }
}

function parseCss(html: string, source: Source, limit = 60): RawItem[] {
  if (!source.container || !source.fields?.length) return []
  const root = parseHTML(html)
  const containers = queryAll(root, source.container).slice(0, limit)
  const out: RawItem[] = []
  for (const c of containers) {
    const item: any = {}
    for (const f of source.fields) {
      const node = f.selector ? queryOne(c, f.selector) : c
      if (!node) continue
      let val = ''
      if (!f.attr || f.attr === 'text') val = textOf(node)
      else val = node.attrs[f.attr.toLowerCase()] || ''
      if (!val) continue
      if (f.key === 'url' || f.key === 'image') val = absUrl(val, source.url)
      if (f.key === 'excerpt') val = val.slice(0, 220)
      item[f.key] = val
    }
    if (item.title) out.push(item)
  }
  return out
}

function looksLikeXml(text: string) {
  const head = text.slice(0, 400).toLowerCase()
  return head.includes('<rss') || head.includes('<feed') || head.includes('<?xml')
}

/** Scrape a source. Returns extracted raw items. Throws on network errors. */
export async function scrapeSource(source: Source): Promise<RawItem[]> {
  const method: Method = source.method

  // Divar official-API connector (JSON via proxy) — no HTML fetch
  if (method === 'divar') {
    return scrapeDivar(source)
  }

  const text = await fetchPage(source.url)

  // Detailed CSS extraction takes priority when configured
  if (method === 'css') {
    return parseCss(text, source)
  }

  if (method === 'rss' || (method === 'auto' && looksLikeXml(text))) {
    const items = parseRSS(text)
    if (items.length) return items
  }
  if (method === 'jsonld' || method === 'auto') {
    const items = parseJsonLd(text)
    if (items.length) return items
  }
  // auto: if the HTML page links to an RSS/Atom feed, follow it (great for
  // news/tag listing pages where the visible HTML is a card list)
  if (method === 'auto') {
    const feed = findFeedLink(text, source.url)
    if (feed) {
      try {
        const x = await fetchPage(feed)
        const items = parseRSS(x)
        if (items.length) return items
      } catch { /* ignore, fall through */ }
    }
  }
  if (method === 'og' || method === 'auto') {
    const items = parseOG(text)
    if (items.length) return items
  }
  // last-ditch: try RSS even if not detected
  if (method === 'auto') {
    const items = parseRSS(text)
    if (items.length) return items
  }
  return []
}

// Discover a feed URL from <link rel="alternate" type="application/rss+xml" href="…">
function findFeedLink(html: string, base: string): string | null {
  const linkTags = html.match(/<link\b[^>]*>/gi) || []
  for (const tag of linkTags) {
    if (!/rss\+xml|atom\+xml/i.test(tag)) continue
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
    if (href) return absUrl(href, base)
  }
  return null
}
