import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getCostConfig, setCostConfig, tokenSellPriceToman } from '@/app/lib/cost-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ ...getCostConfig(), tokenSellPrice: tokenSellPriceToman() }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as any))
  const c = setCostConfig(b)
  return NextResponse.json({ ok: true, ...c, tokenSellPrice: tokenSellPriceToman() })
}
