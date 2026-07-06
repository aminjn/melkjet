import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { getItemById } from '@/app/lib/scraper-store'
import { proxiedRequest } from '@/app/lib/proxy-fetch'
import { fetchDivarPost } from '@/app/lib/divar-post'

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
    const it = await getItemById(itemId)
    storedUrl = it?.url
    const m = (it?.url || '').match(/divar\.ir\/v\/([A-Za-z0-9_-]+)/)
    if (m) token = m[1]
  }
  if (!token || !/^[A-Za-z0-9_-]{4,20}$/.test(token)) {
    return NextResponse.json({ error: 'توکن نامعتبر', token, storedUrl, itemFound: !!storedUrl }, { status: 400 })
  }

  if (debug) {
    const proxyUrl = getAdminData().divar?.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || 'http://127.0.0.1:1080'
    try {
      const res = await proxiedRequest(`https://api.divar.ir/v8/posts-v2/web/${token}`, {
        method: 'GET',
        headers: { accept: 'application/json, text/plain, */*', 'user-agent': UA, origin: 'https://divar.ir', referer: 'https://divar.ir/', 'x-standard-divar-error': 'true' },
        proxyUrl, timeout: 15000,
      })
      const grab = (marker: string, before = 60, after = 350) => { const i = res.body.indexOf(marker); return i >= 0 ? res.body.slice(Math.max(0, i - before), i + after) : '(not found)' }
      return NextResponse.json({ token, status: res.status, size: res.body.length, floorSize: grab('floorSize', 30, 250), numberOfRooms: grab('numberOfRooms', 15, 150) })
    } catch (e: any) {
      return NextResponse.json({ token, error: e?.message || 'error' })
    }
  }

  const post = await fetchDivarPost(token)
  return NextResponse.json(post)
}

