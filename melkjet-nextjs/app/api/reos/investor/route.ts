import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { analyzeInvestment, analyzeConstruction } from '@/app/lib/reos/investor'

// POST /api/reos/investor — {mode:'investment'|'construction', ...ورودی‌ها}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const mode = String(b.mode || 'investment')
  if (mode === 'construction') {
    return NextResponse.json({ ok: true, result: analyzeConstruction({ landCost: Number(b.landCost) || 0, buildCostPerM: Number(b.buildCostPerM) || 0, totalArea: Number(b.totalArea) || 0, sellPricePerM: Number(b.sellPricePerM) || 0, months: Number(b.months) || undefined, preSaleRate: Number(b.preSaleRate) || undefined }) })
  }
  return NextResponse.json({ ok: true, result: analyzeInvestment({ price: Number(b.price) || 0, monthlyRent: Number(b.monthlyRent) || undefined, annualAppreciation: Number(b.annualAppreciation) || undefined, holdYears: Number(b.holdYears) || undefined, downPayment: Number(b.downPayment) || undefined, loanRate: Number(b.loanRate) || undefined, loanMonths: Number(b.loanMonths) || undefined, expensesRate: Number(b.expensesRate) || undefined }) })
}
