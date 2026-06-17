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

    // Collect real photo URLs (exclude icons/logos). Dedup, cap 15.
    const re = /https?:\\?\/\\?\/[^"'\s]*divarcdn[^"'\s]*\.(?:jpe?g|png|webp)/gi
    const found = (res.body.match(re) || []).map(u => u.replace(/\\\//g, '/'))
    const seen = new Set<string>()
    const images: string[] = []
    for (const u of found) {
      if (/widget-icons|\/imgs\/|logo|avatar|brand/i.test(u)) continue
      const key = u.split('?')[0]
      if (seen.has(key)) continue
      seen.add(key); images.push(u)
      if (images.length >= 15) break
    }

    const unesc = (s: string) => s.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/')

    // Longest description (the full توضیحات)
    let description: string | undefined
    const descs = [...res.body.matchAll(/"description"\s*:\s*"((?:[^"\\]|\\.){20,})"/g)].map(m => unesc(m[1]))
    if (descs.length) description = descs.sort((a, b) => b.length - a.length)[0]

    // Key facts: scan small JSON objects; if an object contains a known label,
    // take the other short string in it as the value (robust to field order).
    const LABELS = ['متراژ', 'ساخت', 'سن بنا', 'سال ساخت', 'اتاق', 'تعداد اتاق', 'خواب', 'طبقه', 'ودیعه', 'اجاره', 'اجارهٔ ماهانه', 'قیمت', 'قیمت کل', 'قیمت هر متر', 'پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'جهت ساختمان', 'سند', 'وضعیت واحد']
    const factsMap: Record<string, string> = {}
    for (const om of res.body.matchAll(/\{[^{}]{0,260}\}/g)) {
      const o = om[0]
      const label = LABELS.find(l => o.includes(`"${l}"`))
      if (!label || factsMap[label]) continue
      const vals = [...o.matchAll(/"(?:value|title|text|normalized_text|display_text)":"([^"]{1,40})"/g)]
        .map(x => unesc(x[1]).trim())
        .filter(v => v && !LABELS.includes(v) && v !== 'true' && v !== 'false')
      if (vals.length) factsMap[label] = vals[0]
    }
    // keep a sensible order
    const order = ['متراژ', 'خواب', 'اتاق', 'تعداد اتاق', 'ساخت', 'سال ساخت', 'سن بنا', 'طبقه', 'قیمت', 'قیمت کل', 'قیمت هر متر', 'ودیعه', 'اجاره', 'اجارهٔ ماهانه', 'پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'جهت ساختمان', 'سند', 'وضعیت واحد']
    const facts = order.filter(l => factsMap[l]).map(l => ({ label: l, value: factsMap[l] }))

    return NextResponse.json({ images, description, facts })
  } catch (e: any) {
    return NextResponse.json({ images: [], reason: e?.message || 'error' })
  }
}
