import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getPaymentConfig, setPricingMode, setGateways, type PricingMode } from '@/app/lib/payment-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json(getPaymentConfig(), { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  if (b.pricingMode) setPricingMode(String(b.pricingMode) as PricingMode)
  if (Array.isArray(b.gateways)) setGateways(b.gateways)
  return NextResponse.json({ ok: true, ...getPaymentConfig() })
}
