import { NextRequest } from 'next/server'
import { agentTerritories } from '@/app/lib/reos/territory'
import { getTrust } from '@/app/lib/reos/trust'
import { primeConfig } from '@/app/lib/reos/reos-config'

// GET /api/reos/territory/card?agent=09xxx — کارتِ اشتراکِ اعتبار (SVG) برای انتشارِ ویروسی.
// عمومی (بدونِ session): آژانس پروفایلِ اعتبارِ خود را به‌اشتراک می‌گذارد.
export async function GET(req: NextRequest) {
  await primeConfig().catch(() => {})
  const agent = String(new URL(req.url).searchParams.get('agent') || '').replace(/\D/g, '')
  const name = new URL(req.url).searchParams.get('name') || 'آژانسِ املاک'
  const empty = { score: 50 }
  const [terrs, trust] = agent ? await Promise.all([agentTerritories(agent).catch(() => []), getTrust(agent).catch(() => empty)]) : [[], empty]
  const owned = terrs.filter(t => t.isOwner)
  const top = terrs[0]
  const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
  const tier = top?.tier || 'تازه‌وارد'
  const esc = (t: string) => t.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Vazirmatn, Tahoma, sans-serif" direction="rtl">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0b1220"/><stop offset="1" stop-color="#131c30"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8c37a"/><stop offset="1" stop-color="#c99a4b"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="8" fill="url(#gold)"/>
  <text x="1140" y="90" text-anchor="end" fill="#e8c37a" font-size="34" font-weight="700">ملک‌جت · هوشِ بازار</text>
  <text x="1140" y="200" text-anchor="end" fill="#fff" font-size="64" font-weight="800">${esc(name)}</text>
  <text x="1140" y="270" text-anchor="end" fill="#9fb0c8" font-size="34">سطحِ اقتدار: <tspan fill="#e8c37a" font-weight="700">${esc(tier)}</tspan></text>
  <g>
    <rect x="820" y="330" width="320" height="200" rx="18" fill="#1b2740"/>
    <text x="980" y="400" text-anchor="middle" fill="#e8c37a" font-size="80" font-weight="800">${fa(owned.length)}</text>
    <text x="980" y="450" text-anchor="middle" fill="#9fb0c8" font-size="30">قلمروِ تحتِ مالکیت</text>
    <text x="980" y="500" text-anchor="middle" fill="#7f8ea8" font-size="26">امتیازِ اعتماد: ${fa((trust as { score: number }).score)}</text>
  </g>
  <g>
    <rect x="470" y="330" width="320" height="200" rx="18" fill="#1b2740"/>
    <text x="630" y="400" text-anchor="middle" fill="#7ee0b8" font-size="80" font-weight="800">${fa(top?.score || 0)}</text>
    <text x="630" y="450" text-anchor="middle" fill="#9fb0c8" font-size="30">بالاترین امتیازِ قلمرو</text>
    <text x="630" y="500" text-anchor="middle" fill="#7f8ea8" font-size="26">${fa(terrs.length)} قلمروِ فعال</text>
  </g>
  <text x="60" y="590" fill="#5c6a84" font-size="24">melkjet.com — رتبه‌بندیِ حرفه‌ایِ بازارِ املاک</text>
</svg>`
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
}
