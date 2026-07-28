import { NextRequest } from 'next/server'
import { geoApiCfg } from '@/app/lib/geo-api'

// فاز ۲۳۵ — پروکسیِ کاشیِ نقشه: مرورگر نمی‌تواند برای <img> هدرِ X-API-Key بفرستد، پس کاشی از
// اینجا رد می‌شود و کلید سمتِ سرور می‌ماند. کش عمومیِ یک‌روزه تا بارِ سرور ناچیز بماند
// (کاشی‌ها با نسخهٔ داده عوض می‌شوند، نه لحظه‌ای).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z, x, y } = await ctx.params
  const zi = parseInt(z, 10), xi = parseInt(x, 10), yi = parseInt(y, 10)
  if (!Number.isFinite(zi) || !Number.isFinite(xi) || !Number.isFinite(yi) || zi < 0 || zi > 20) return new Response('bad tile', { status: 400 })
  const { baseUrl, apiKey } = geoApiCfg()
  if (!baseUrl) return new Response('no-geoapi', { status: 404 })
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 8000)
    const r = await fetch(`${baseUrl}/v1/tiles/${zi}/${xi}/${yi}.png?style=day${apiKey ? `&key=${encodeURIComponent(apiKey)}` : ''}`, {
      headers: apiKey ? { 'X-API-Key': apiKey, 'Api-Key': apiKey } : undefined,
      signal: ctl.signal,
    })
    clearTimeout(timer)
    if (r.status === 204) return new Response(null, { status: 204 })
    if (!r.ok) return new Response('upstream ' + r.status, { status: 502 })
    const buf = Buffer.from(await r.arrayBuffer())
    const type = r.headers.get('content-type') || 'image/png'
    return new Response(buf, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } })
  } catch {
    return new Response('upstream-error', { status: 502 })
  }
}
