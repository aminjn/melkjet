import { proxiedRequest } from './proxy-fetch'

// آپلودِ عکس روی imgbb (CDN جهانی i.ibb.co که سرورِ گپ می‌تواند بخوانَدش). از طریق
// پروکسیِ سرور به api.imgbb.com می‌رویم (هاست خارجی است). expiration برای حذف خودکار.
export async function uploadToImgbb(apiKey: string, base64NoPrefix: string, proxyUrl?: string, expiration = 3600, timeout = 25000): Promise<string> {
  const body = `key=${encodeURIComponent(apiKey)}&expiration=${expiration}&image=${encodeURIComponent(base64NoPrefix)}`
  const res = await proxiedRequest('https://api.imgbb.com/1/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    proxyUrl,
    timeout,
  })
  let d: any = null
  try { d = JSON.parse(res.body) } catch {}
  const url = d?.data?.url
  if (res.status === 200 && url) return String(url)
  throw new Error(`آپلود imgbb ناموفق (HTTP ${res.status}): ${(d?.error?.message || res.body || '').slice(0, 150)}`)
}
