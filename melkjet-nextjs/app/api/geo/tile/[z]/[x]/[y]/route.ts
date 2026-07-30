import { NextRequest } from 'next/server'
import { geoApiCfg } from '@/app/lib/geo-api'
import { redisEnabled, rGetBuf, rSetEx } from '@/app/lib/redis'

// فاز ۲۳۵ — پروکسیِ کاشیِ نقشه: مرورگر نمی‌تواند برای <img> هدرِ X-API-Key بفرستد، پس کاشی از
// اینجا رد می‌شود و کلید سمتِ سرور می‌ماند. کش عمومیِ یک‌روزه تا بارِ سرور ناچیز بماند
// (کاشی‌ها با نسخهٔ داده عوض می‌شوند، نه لحظه‌ای).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z, x, y } = await ctx.params
  const zi = parseInt(z, 10), xi = parseInt(x, 10), yi = parseInt(y, 10)
  if (!Number.isFinite(zi) || !Number.isFinite(xi) || !Number.isFinite(yi) || zi < 0 || zi > 20) return new Response('bad tile', { status: 400 })
  const { baseUrl, apiKey } = geoApiCfg()
  if (!baseUrl) return new Response('no-geoapi', { status: 404 })
  // فاز ۲۴۰ — کشِ مشترکِ Redis (بین‌اینستنسی): با ۴+ اینستنس و کاربرِ میلیونی، هر کاشی یک‌بار از
  // سامانه می‌آید نه یک‌بار به‌ازای هر اینستنس/درخواست. نبودِ Redis = همان مسیرِ قبلی.
  const rkey = `tile:2:${zi}/${xi}/${yi}`
  if (redisEnabled()) {
    const hit = await rGetBuf(rkey)
    if (hit && hit.length) return new Response(new Uint8Array(hit), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400', 'X-Cache': 'redis' } })
  }
  try {
    const ctl = new AbortController()
    // فاز ۲۳۸: تایم‌اوت ۸→۱۲ث (رندرِ سردِ z15 روی سرورِ سامانه کند است — همان پاسخِ «۱۴ بایتی»)
    const timer = setTimeout(() => ctl.abort(), 12000)
    // فاز ۲۳۷: no-store — کشِ دادهٔ Next نباید کاشیِ placeholderِ قدیمی را بعد از واقعی‌شدنِ کاشی‌ها سرو کند.
    // فاز ۲۳۸: mv=2 کش‌شکنِ nginxِ خودِ سامانه — کلیدِ کشِ placeholderهای قدیمی دیگر هرگز hit نمی‌شود.
    const r = await fetch(`${baseUrl}/v1/tiles/${zi}/${xi}/${yi}.png?style=day&mv=2${apiKey ? `&key=${encodeURIComponent(apiKey)}` : ''}`, {
      headers: apiKey ? { 'X-API-Key': apiKey, 'Api-Key': apiKey } : undefined,
      signal: ctl.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)
    if (r.status === 204) return new Response(null, { status: 204 })
    if (!r.ok) return new Response('upstream ' + r.status, { status: 502 })
    const buf = Buffer.from(await r.arrayBuffer())
    const type = r.headers.get('content-type') || 'image/png'
    if (redisEnabled() && buf.length) rSetEx(rkey, 86400, buf).catch(() => {})
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } })
  } catch {
    return new Response('upstream-error', { status: 502 })
  }
}
