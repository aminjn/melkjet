import { getAdminData } from './admin-store'
import { shecanRequest } from './shecan-https'

// کوتاه‌کردنِ لینک با سرویسِ nxal (https://nxal.ir). کلید در هدرِ X-Api-Key.
// در صورتِ نبودِ کلید یا خطا، null برمی‌گرداند (تماس‌گیرنده به لینکِ بلند برمی‌گردد).
export async function shortenUrl(longUrl: string): Promise<string | null> {
  const c = getAdminData().shortener
  if (!c?.apiKey) return null
  const base = (c.baseUrl || 'https://nxal.ir').replace(/\/$/, '')
  try {
    const res = await shecanRequest(`${base}/api/v1/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': c.apiKey, accept: 'application/json' },
      body: JSON.stringify({ url: longUrl, domain: c.domain || undefined, utmSource: 'sms' }),
      timeout: 15000,
    })
    if (res.status < 200 || res.status >= 300) return null
    const d = JSON.parse(res.body)
    return d?.success && d?.data?.shortUrl ? String(d.data.shortUrl) : null
  } catch { return null }
}

// آدرسِ پایهٔ سایتِ ما برای ساختِ لینکِ ریدایرکتِ شمارنده (پیش‌فرض melkjet.com).
export function siteBase(): string {
  return (getAdminData().shortener?.siteBase || 'https://melkjet.com').replace(/\/$/, '')
}
