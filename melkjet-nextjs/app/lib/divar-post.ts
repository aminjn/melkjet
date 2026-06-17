import { getAdminData } from './admin-store'
import { proxiedRequest } from './proxy-fetch'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export interface DivarPost {
  images: string[]
  description?: string
  facts: { label: string; value: string }[]
  amenities: string[]
  lat?: number
  lng?: number
  reason?: string
}

export function divarToken(url?: string): string | null {
  const m = (url || '').match(/divar\.ir\/v\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

// واکشی جزئیات کامل یک آگهی دیوار (همهٔ عکس‌ها/مشخصات/توضیحات/مختصات) از طریق پروکسی.
export async function fetchDivarPost(token: string): Promise<DivarPost> {
  const empty: DivarPost = { images: [], facts: [], amenities: [] }
  if (!token || !/^[A-Za-z0-9_-]{4,20}$/.test(token)) return { ...empty, reason: 'bad_token' }

  const proxyUrl = getAdminData().divar?.proxyUrl
    || process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || undefined

  try {
    const res = await proxiedRequest(`https://api.divar.ir/v8/posts-v2/web/${token}`, {
      method: 'GET',
      headers: { accept: 'application/json, text/plain, */*', 'user-agent': UA, origin: 'https://divar.ir', referer: 'https://divar.ir/', 'x-standard-divar-error': 'true' },
      proxyUrl,
      timeout: 15000,
    })
    if (res.status !== 200) return { ...empty, reason: `http_${res.status}` }

    const re = /https?:\\?\/\\?\/[^"'\s]*divarcdn[^"'\s]*\.(?:jpe?g|png|webp)/gi
    const found = (res.body.match(re) || []).map(u => u.replace(/\\\//g, '/'))
    const byName = new Map<string, string>()
    for (const u of found) {
      if (/widget-icons|\/imgs\/|logo|avatar|brand/i.test(u)) continue
      const name = (u.split('?')[0].split('/').pop() || u)
      const ex = byName.get(name)
      if (!ex || (/thumbnail/i.test(ex) && !/thumbnail/i.test(u))) byName.set(name, u)
    }
    const images = Array.from(byName.values()).slice(0, 20)

    let d: any = null
    try { d = JSON.parse(res.body) } catch { /* fall back below */ }

    const strOf = (x: any): string => {
      if (x == null) return ''
      if (typeof x === 'string') return x
      if (typeof x === 'number') return String(x)
      if (typeof x === 'object') return strOf(x.value ?? x.str?.value ?? x.text ?? x.normalized_text ?? x.name ?? x.title ?? '')
      return ''
    }
    const findFirst = (o: any, key: string): any => {
      let r: any
      const walk = (x: any) => { if (r !== undefined || !x || typeof x !== 'object') return; if (key in x) { r = x[key]; return }; for (const k in x) walk(x[k]) }
      walk(o); return r
    }

    const FACT_LABELS = ['متراژ', 'ساخت', 'سن بنا', 'سال ساخت', 'اتاق', 'تعداد اتاق', 'خواب', 'طبقه', 'ودیعه', 'اجاره', 'اجارهٔ ماهانه', 'قیمت', 'قیمت کل', 'قیمت کل (تومان)', 'قیمت هر متر', 'پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'جهت ساختمان', 'سند', 'وضعیت واحد', 'نوع']
    const AMENITY_WORDS = ['آسانسور', 'پارکینگ', 'انباری', 'بالکن', 'تراس', 'کولر', 'پکیج', 'لابی', 'سالن اجتماعات', 'استخر', 'سونا', 'جکوزی', 'روف‌گاردن', 'دوربین', 'سیستم امنیتی', 'لاندری', 'مستر', 'نگهبان', 'سرایدار', 'فول مشاعات']
    const factsMap: Record<string, string> = {}
    const amenitySet = new Set<string>()
    let lat: number | undefined, lng: number | undefined
    let description: string | undefined

    if (d) {
      const fs = findFirst(d, 'floorSize'); if (fs) factsMap['متراژ'] = strOf(fs).replace(/[^\d۰-۹٬,]/g, '') + ' متر'
      const nr = findFirst(d, 'numberOfRooms'); if (nr != null) factsMap['اتاق'] = strOf(nr)
      const la = findFirst(d, 'latitude'), lo = findFirst(d, 'longitude')
      if (typeof la === 'number' && typeof lo === 'number') { lat = la; lng = lo }
      const dsc = findFirst(d, 'description'); if (dsc) description = strOf(dsc)
      let longest = description || ''
      const dwalk = (x: any) => {
        if (typeof x === 'string') { if (x.length > longest.length) longest = x }
        else if (x && typeof x === 'object') { for (const k in x) dwalk(x[k]) }
      }
      dwalk(d)
      if (longest.length > (description?.length || 0)) description = longest

      const walk = (x: any) => {
        if (!x || typeof x !== 'object') return
        if (Array.isArray(x)) { x.forEach(walk); return }
        if ('title' in x && 'value' in x) {
          const a = strOf(x.title).trim(), b = strOf(x.value).trim()
          if (a && b && a.length <= 40 && b.length <= 40) {
            if (FACT_LABELS.includes(b) && !factsMap[b]) factsMap[b] = a
            else if (FACT_LABELS.includes(a) && !factsMap[a]) factsMap[a] = b
          }
        }
        const t = strOf(x.title).trim()
        if (t && AMENITY_WORDS.some(w => t === w || t.includes(w))) AMENITY_WORDS.forEach(w => { if (t.includes(w)) amenitySet.add(w) })
        for (const k in x) walk(x[k])
      }
      walk(d)
    }

    const dtext = description || ''
    AMENITY_WORDS.forEach(w => { if (dtext.includes(w)) amenitySet.add(w) })

    if (!description) {
      const unesc = (s: string) => s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/')
      const descs = [...res.body.matchAll(/"description"\s*:\s*"((?:[^"\\]|\\.){20,})"/g)].map(m => unesc(m[1]))
      if (descs.length) description = descs.sort((a, b) => b.length - a.length)[0]
    }

    const order = ['متراژ', 'خواب', 'اتاق', 'تعداد اتاق', 'ساخت', 'سال ساخت', 'سن بنا', 'طبقه', 'قیمت', 'قیمت کل', 'قیمت کل (تومان)', 'قیمت هر متر', 'ودیعه', 'اجاره', 'اجارهٔ ماهانه', 'نوع', 'سند', 'جهت ساختمان', 'وضعیت واحد']
    const facts = order.filter(l => factsMap[l]).map(l => ({ label: l, value: factsMap[l] }))
    const amenities = Array.from(amenitySet)

    return { images, description, facts, amenities, lat, lng }
  } catch (e: any) {
    return { ...empty, reason: e?.message || 'error' }
  }
}
