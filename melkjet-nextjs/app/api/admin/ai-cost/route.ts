import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getCostConfig, setCostConfig, tokenSellPriceToman, syncModels } from '@/app/lib/cost-store'
import { repriceTokenPackages } from '@/app/lib/comm-store'
import { listModelsWithPricing } from '@/app/lib/gapgpt'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ ...getCostConfig(), tokenSellPrice: tokenSellPriceToman() }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  // دریافتِ خودکارِ قیمت‌ها از API (تا دستی وارد نشود)
  if (b.action === 'syncModels') {
    try {
      const fetched = await listModelsWithPricing()
      if (!fetched.length) return NextResponse.json({ error: 'API قیمتی برنگرداند — شاید این درگاه قیمت را ارائه نمی‌دهد.' }, { status: 400 })
      const r = syncModels(fetched)
      return NextResponse.json({ ok: true, ...getCostConfig(), tokenSellPrice: tokenSellPriceToman(), ...r })
    } catch (e: any) { return NextResponse.json({ error: e?.message || 'خطا در دریافت از API' }, { status: 500 }) }
  }
  const c = setCostConfig(b)
  // اعمالِ خودکارِ قیمتِ بسته‌های توکن از نرخِ محاسبه‌شده
  let repriced = 0
  if (b.applyTokenPricing) repriced = await repriceTokenPackages(tokenSellPriceToman(), c.roundTo)
  return NextResponse.json({ ok: true, ...c, tokenSellPrice: tokenSellPriceToman(), repriced })
}
