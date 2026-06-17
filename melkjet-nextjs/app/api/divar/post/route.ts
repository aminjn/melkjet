import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { proxiedRequest } from '@/app/lib/proxy-fetch'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Fetch a Divar post's full detail (all photos) by token, via the proxy.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token || !/^[A-Za-z0-9_-]{4,20}$/.test(token)) return NextResponse.json({ error: 'توکن نامعتبر' }, { status: 400 })

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
    if (res.status !== 200) return NextResponse.json({ images: [], reason: `http_${res.status}` })

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

    // Try to pull a longer description (best-effort)
    const descMatch = res.body.match(/"description"\s*:\s*"((?:[^"\\]|\\.){20,})"/)
    const description = descMatch ? descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/') : undefined

    return NextResponse.json({ images, description })
  } catch (e: any) {
    return NextResponse.json({ images: [], reason: e?.message || 'error' })
  }
}
