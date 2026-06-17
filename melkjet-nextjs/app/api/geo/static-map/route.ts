import { NextRequest } from 'next/server'
import { getAdminData } from '@/app/lib/admin-store'
import { shecanRequestBuffer } from '@/app/lib/shecan-https'

// Neshan static map image (domestic, reliable from Iran). Proxied so the key stays server-side.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const lat = parseFloat(sp.get('lat') || ''), lng = parseFloat(sp.get('lng') || '')
  if (Number.isNaN(lat) || Number.isNaN(lng)) return new Response('bad coords', { status: 400 })

  // نقشهٔ استاتیک نشان به «کلید نقشه» (web.…) نیاز دارد، نه «کلید سرویس» (service.…)
  const nz = getAdminData().neshan
  const key = nz?.mapKey || nz?.serviceKey
  if (!key) return new Response('no-neshan-key', { status: 404 })

  // استایل «neshan» منقضی می‌شود؛ از standard-night (نمایش شب، هماهنگ با تم تیره) استفاده می‌کنیم
  const url = `https://api.neshan.org/v4/static?key=${encodeURIComponent(key)}&type=standard-night&zoom=15&center=${lat},${lng}&width=720&height=320&marker=red,${lat},${lng}`
  try {
    // از DNS شکن داخل برنامه (مستقل از resolv.conf سرور)
    const r = await shecanRequestBuffer(url, { timeout: 12000 })
    if (r.status < 200 || r.status >= 400) return new Response('neshan-error', { status: 502 })
    return new Response(new Uint8Array(r.buffer), { headers: { 'content-type': r.contentType, 'cache-control': 'public, max-age=86400' } })
  } catch {
    return new Response('fetch-failed', { status: 502 })
  }
}
