import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { getItemById } from '@/app/lib/scraper-store'
import { proxiedRequest } from '@/app/lib/proxy-fetch'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Fetch a Divar post's full detail (all photos) by token, via the proxy.
// ?id=<melkjetItemId> resolves the token from the stored item; &debug=1 returns structure.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  let token = sp.get('token') || ''
  const debug = sp.get('debug') === '1'
  const itemId = sp.get('id')
  let storedUrl: string | undefined
  if (itemId) {
    const it = getItemById(itemId)
    storedUrl = it?.url
    const m = (it?.url || '').match(/divar\.ir\/v\/([A-Za-z0-9_-]+)/)
    if (m) token = m[1]
  }
  if (!token || !/^[A-Za-z0-9_-]{4,20}$/.test(token)) {
    return NextResponse.json({ error: 'توکن نامعتبر', token, storedUrl, itemFound: !!storedUrl }, { status: 400 })
  }

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
    if (debug) {
      const grab = (marker: string, before = 60, after = 350) => { const i = res.body.indexOf(marker); return i >= 0 ? res.body.slice(Math.max(0, i - before), i + after) : '(not found)' }
      return NextResponse.json({
        token, status: res.status, size: res.body.length,
        webengage: grab('"webengage"', 15, 800),
        floorSize: grab('floorSize', 30, 250),
        numberOfRooms: grab('numberOfRooms', 15, 150),
        build: grab('ساخت', 220, 120),
        floor: grab('طبقه', 220, 120),
      })
    }
    if (res.status !== 200) return NextResponse.json({ images: [], reason: `http_${res.status}`, token })

    // Collect real photo URLs (exclude icons/logos). Dedup, cap 20.
    const re = /https?:\\?\/\\?\/[^"'\s]*divarcdn[^"'\s]*\.(?:jpe?g|png|webp)/gi
    const found = (res.body.match(re) || []).map(u => u.replace(/\\\//g, '/'))
    const seen = new Set<string>()
    const images: string[] = []
    for (const u of found) {
      if (/widget-icons|\/imgs\/|logo|avatar|brand/i.test(u)) continue
      const key = u.split('?')[0]
      if (seen.has(key)) continue
      seen.add(key); images.push(u)
      if (images.length >= 20) break
    }

    // ── Parse the JSON and extract everything structured ──
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
      let res: any
      const walk = (x: any) => { if (res !== undefined || !x || typeof x !== 'object') return; if (key in x) { res = x[key]; return }; for (const k in x) walk(x[k]) }
      walk(o); return res
    }

    const FACT_LABELS = ['متراژ', 'ساخت', 'سن بنا', 'سال ساخت', 'اتاق', 'تعداد اتاق', 'خواب', 'طبقه', 'ودیعه', 'اجاره', 'اجارهٔ ماهانه', 'قیمت', 'قیمت کل', 'قیمت کل (تومان)', 'قیمت هر متر', 'پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'جهت ساختمان', 'سند', 'وضعیت واحد', 'نوع']
    const AMENITY_WORDS = ['آسانسور', 'پارکینگ', 'انباری', 'بالکن', 'تراس', 'کولر', 'پکیج', 'لابی', 'سالن اجتماعات', 'استخر', 'سونا', 'جکوزی', 'روف‌گاردن', 'دوربین', 'سیستم امنیتی', 'لاندری', 'مستر', 'نگهبان', 'سرایدار', 'فول مشاعات']
    const factsMap: Record<string, string> = {}
    const amenitySet = new Set<string>()
    let lat: number | undefined, lng: number | undefined
    let description: string | undefined

    if (d) {
      // schema.org structured fields (most reliable)
      const fs = findFirst(d, 'floorSize'); if (fs) factsMap['متراژ'] = strOf(fs).replace(/[^\d۰-۹٬,]/g, '') + ' متر'
      const nr = findFirst(d, 'numberOfRooms'); if (nr != null) factsMap['اتاق'] = strOf(nr)
      // geo for the map
      const la = findFirst(d, 'latitude'), lo = findFirst(d, 'longitude')
      if (typeof la === 'number' && typeof lo === 'number') { lat = la; lng = lo }
      // full description
      const dsc = findFirst(d, 'description'); if (dsc) description = strOf(dsc)

      // walk widgets: collect {title,value} fact pairs + amenity chips
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
        // amenity feature rows often just have a title
        const t = strOf(x.title).trim()
        if (t && AMENITY_WORDS.some(w => t === w || t.includes(w))) AMENITY_WORDS.forEach(w => { if (t.includes(w)) amenitySet.add(w) })
        for (const k in x) walk(x[k])
      }
      walk(d)
    }

    // amenities also from the description text
    const dtext = description || ''
    AMENITY_WORDS.forEach(w => { if (dtext.includes(w)) amenitySet.add(w) })

    // longest description fallback (regex) if JSON parse missed it
    if (!description) {
      const unesc = (s: string) => s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/')
      const descs = [...res.body.matchAll(/"description"\s*:\s*"((?:[^"\\]|\\.){20,})"/g)].map(m => unesc(m[1]))
      if (descs.length) description = descs.sort((a, b) => b.length - a.length)[0]
    }

    const order = ['متراژ', 'خواب', 'اتاق', 'تعداد اتاق', 'ساخت', 'سال ساخت', 'سن بنا', 'طبقه', 'قیمت', 'قیمت کل', 'قیمت کل (تومان)', 'قیمت هر متر', 'ودیعه', 'اجاره', 'اجارهٔ ماهانه', 'نوع', 'سند', 'جهت ساختمان', 'وضعیت واحد']
    const facts = order.filter(l => factsMap[l]).map(l => ({ label: l, value: factsMap[l] }))
    const amenities = Array.from(amenitySet)

    return NextResponse.json({ images, description, facts, amenities, lat, lng })
  } catch (e: any) {
    return NextResponse.json({ images: [], reason: e?.message || 'error' })
  }
}
