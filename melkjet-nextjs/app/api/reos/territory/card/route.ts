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

  // نکتهٔ SVG: direction="rtl" روی ریشه معنای text-anchor را برعکس می‌کند و متن‌ها از لبه‌ها بیرون می‌زنند.
  // پس بدونِ direction؛ متنِ فارسی (که خودش راست‌به‌چپ شکل می‌گیرد) با anchor=end به لبهٔ راست می‌چسبد و به چپ باز می‌شود.
  const trustScore = (trust as { score: number }).score || 0
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Vazirmatn, Tahoma, sans-serif">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0b1220"/><stop offset="1" stop-color="#131c30"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8c37a"/><stop offset="1" stop-color="#c99a4b"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="8" fill="url(#gold)"/>
  <text x="1140" y="92" text-anchor="end" fill="#e8c37a" font-size="32" font-weight="700">ملک‌جت · هوشِ بازار</text>
  <text x="1140" y="186" text-anchor="end" fill="#ffffff" font-size="58" font-weight="800">${esc(name).slice(0, 40)}</text>
  <text x="1140" y="248" text-anchor="end" fill="#9fb0c8" font-size="30">سطحِ اقتدار: <tspan fill="#e8c37a" font-weight="700">${esc(tier)}</tspan></text>
  <g>
    <rect x="800" y="300" width="340" height="220" rx="18" fill="#1b2740" stroke="#26365a"/>
    <text x="970" y="392" text-anchor="middle" fill="#e8c37a" font-size="84" font-weight="800">${fa(owned.length)}</text>
    <text x="970" y="446" text-anchor="middle" fill="#c5d2e6" font-size="30" font-weight="700">قلمروِ تحتِ مالکیت</text>
    <text x="970" y="492" text-anchor="middle" fill="#8b9ab4" font-size="25">امتیازِ اعتماد: ${fa(trustScore)} از ۱۰۰</text>
  </g>
  <g>
    <rect x="430" y="300" width="340" height="220" rx="18" fill="#1b2740" stroke="#26365a"/>
    <text x="600" y="392" text-anchor="middle" fill="#7ee0b8" font-size="84" font-weight="800">${fa(top?.score || 0)}</text>
    <text x="600" y="446" text-anchor="middle" fill="#c5d2e6" font-size="30" font-weight="700">بالاترین امتیازِ قلمرو</text>
    <text x="600" y="492" text-anchor="middle" fill="#8b9ab4" font-size="25">${fa(terrs.length)} قلمروِ فعال</text>
  </g>
  <g>
    <rect x="60" y="300" width="340" height="220" rx="18" fill="#152036" stroke="#26365a"/>
    <text x="230" y="380" text-anchor="middle" fill="#c9a84c" font-size="44" font-weight="800">✓ تأییدشده</text>
    <text x="230" y="440" text-anchor="middle" fill="#c5d2e6" font-size="28">پروفایلِ حرفه‌ای در ملک‌جت</text>
    <text x="230" y="486" text-anchor="middle" fill="#8b9ab4" font-size="24">رتبه‌بندی از رفتارِ واقعیِ بازار</text>
  </g>
  <text x="60" y="592" fill="#5c6a84" font-size="26" font-weight="700">melkjet.com</text>
  <text x="1140" y="592" text-anchor="end" fill="#5c6a84" font-size="24">رتبه‌بندیِ حرفه‌ایِ بازارِ املاک</text>
</svg>`
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
}
