import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { proxiedRequest } from '@/app/lib/proxy-fetch'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Try to fetch a Divar post's contact phone by token (best-effort, via proxy).
// Divar gates the phone behind auth for many ads — returns {phone:null} if unavailable.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token || !/^[A-Za-z0-9_-]{4,20}$/.test(token)) return NextResponse.json({ error: 'توکن نامعتبر' }, { status: 400 })

  const proxyUrl = getAdminData().divar?.proxyUrl || 'http://127.0.0.1:1080'
    || process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || undefined
  const headers = { accept: 'application/json, text/plain, */*', 'user-agent': UA, origin: 'https://divar.ir', referer: 'https://divar.ir/', 'x-standard-divar-error': 'true' }

  const extract = (body: string): string | null => {
    const m = body.match(/(?:\+?98|0)9\d{9}/)
    if (!m) return null
    let p = m[0].replace(/^\+?98/, '0')
    if (!p.startsWith('0')) p = '0' + p
    return p
  }

  try {
    for (const url of [
      `https://api.divar.ir/v8/postcontact/web/${token}`,
      `https://api.divar.ir/v8/posts-v2/web/${token}/contact`,
    ]) {
      const res = await proxiedRequest(url, { method: 'GET', headers, proxyUrl, timeout: 12000 }).catch(() => null)
      if (res && res.status === 200) {
        const phone = extract(res.body)
        if (phone) return NextResponse.json({ phone })
      }
    }
    return NextResponse.json({ phone: null, reason: 'gated' })
  } catch (e: any) {
    return NextResponse.json({ phone: null, reason: e?.message || 'error' })
  }
}
