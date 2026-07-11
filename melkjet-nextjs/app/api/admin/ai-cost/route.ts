import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getCostConfig, setCostConfig, tokenSellPriceToman, syncModels } from '@/app/lib/cost-store'
import { repriceTokenPackages } from '@/app/lib/comm-store'
import { listModelsWithPricing, fetchGapSitePricing } from '@/app/lib/gapgpt'
import { aiUsageSummary } from '@/app/lib/ai-usage-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  // فاز ۵۴: دفترِ جزءبه‌جزِ مصرفِ AI — روز/منبع/مدل/آخرین تماس‌ها
  const usage = await aiUsageSummary(30).catch(() => null)
  return NextResponse.json({ ...getCostConfig(), tokenSellPrice: tokenSellPriceToman(), usage }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  // دریافتِ خودکارِ قیمت‌ها از API (تا دستی وارد نشود)
  if (b.action === 'syncModels') {
    try {
      // فاز ۸۵: دو منبعِ واقعی با هم — APIِ خودِ درگاه + صفحهٔ قیمتِ سایتِ گپ (برای مدل‌هایی که API قیمتشان را نمی‌دهد)
      const fetched = await listModelsWithPricing().catch(() => [])
      const site = await fetchGapSitePricing().catch(e => ({ list: [], note: String(e?.message || e) }))
      const all = [...fetched, ...site.list]
      if (!all.length) return NextResponse.json({ error: `هیچ منبعی قیمت نداد — ${site.note || 'API هم خالی بود'}` }, { status: 400 })
      const r = syncModels(all)
      return NextResponse.json({ ok: true, ...getCostConfig(), tokenSellPrice: tokenSellPriceToman(), ...r, sitePriced: site.list.length, siteNote: site.note })
    } catch (e: any) { return NextResponse.json({ error: e?.message || 'خطا در دریافت از API' }, { status: 500 }) }
  }
  const c = setCostConfig(b)
  // اعمالِ خودکارِ قیمتِ بسته‌های توکن از نرخِ محاسبه‌شده
  let repriced = 0
  if (b.applyTokenPricing) repriced = await repriceTokenPackages(tokenSellPriceToman(), c.roundTo)
  return NextResponse.json({ ok: true, ...c, tokenSellPrice: tokenSellPriceToman(), repriced })
}
