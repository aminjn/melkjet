import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getSmsCostConfig, setSmsCostConfig, smsSellPriceToman, smsCostRial } from '@/app/lib/sms-cost-store'
import { repriceSmsPackages } from '@/app/lib/comm-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ ...getSmsCostConfig(), smsSellPrice: smsSellPriceToman(), smsCostRial: smsCostRial() }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const c = setSmsCostConfig(b)
  let repriced = 0
  if (b.applySmsPricing) repriced = repriceSmsPackages(smsSellPriceToman(), c.roundTo)
  return NextResponse.json({ ok: true, ...c, smsSellPrice: smsSellPriceToman(), smsCostRial: smsCostRial(), repriced })
}
