// REOS v3 · Investor Intelligence / Investor OS — تحلیلِ مالیِ سرمایه‌گذاری و ساخت‌وساز.
// ROI · IRR · NPV · Payback · Rental Yield · Cap Rate · Construction Yield/Risk. توابعِ خالص و تست‌پذیر.

// ── primitiveهای مالی ──
export function npv(rate: number, cashflows: number[]): number {
  let s = 0
  for (let t = 0; t < cashflows.length; t++) s += cashflows[t] / Math.pow(1 + rate, t)
  return s
}
// IRR با بایسکشن (پایدار برای جریانِ متعارف: منفی در t0، سپس مثبت‌ها).
export function irr(cashflows: number[]): number {
  const f = (r: number) => npv(r, cashflows)
  let lo = -0.9, hi = 10
  const flo = f(lo), fhi = f(hi)
  if (flo === 0) return lo
  if (isNaN(flo) || isNaN(fhi) || flo * fhi > 0) return NaN   // ریشه‌ای در بازه نیست
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = f(mid)
    if (Math.abs(fm) < 1e-6) return Math.round(mid * 10000) / 10000
    if (flo * fm < 0) hi = mid; else lo = mid
  }
  return Math.round(((lo + hi) / 2) * 10000) / 10000
}
export function paybackPeriod(cashflows: number[]): number {
  let cum = 0
  for (let t = 0; t < cashflows.length; t++) {
    const prev = cum; cum += cashflows[t]
    if (cum >= 0 && prev < 0) { const frac = cashflows[t] ? -prev / cashflows[t] : 0; return Math.round((t - 1 + frac) * 100) / 100 }
  }
  return -1   // بازنگشت در بازه
}
export function roi(gain: number, cost: number): number { return cost ? Math.round((gain / cost) * 1000) / 10 : 0 }
export function rentalYield(annualRent: number, price: number): number { return price ? Math.round((annualRent / price) * 1000) / 10 : 0 }
// قسطِ ماهانهٔ وام (اقساطِ مساوی).
export function mortgagePayment(principal: number, annualRate: number, months: number): number {
  if (!principal || !months) return 0
  const r = annualRate / 12
  if (r === 0) return Math.round(principal / months)
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -months)))
}

// ── تحلیلِ سرمایه‌گذاریِ ملک (خرید-برای-اجاره/سرمایه) ──
export interface InvestmentInput {
  price: number; monthlyRent?: number; annualAppreciation?: number; holdYears?: number
  downPayment?: number; loanRate?: number; loanMonths?: number; expensesRate?: number
}
export function analyzeInvestment(inp: InvestmentInput) {
  const price = inp.price || 0
  const years = Math.max(1, inp.holdYears || 5)
  const down = inp.downPayment ?? price
  const loan = Math.max(0, price - down)
  const loanRate = inp.loanRate ?? 0.23
  const loanMonths = inp.loanMonths || 240
  const monthlyPay = loan ? mortgagePayment(loan, loanRate, loanMonths) : 0
  const rent = inp.monthlyRent || 0
  const exp = inp.expensesRate ?? 0.1
  const appr = inp.annualAppreciation ?? 0.2

  // جریانِ نقدیِ سالانه: t0 = آورده؛ هر سال اجارهٔ خالص − اقساط؛ سالِ آخر + فروش − ماندهٔ وام.
  const annualNet = rent * 12 * (1 - exp) - monthlyPay * 12
  const cashflows: number[] = [-down]
  for (let y = 1; y <= years; y++) {
    let cf = annualNet
    if (y === years) {
      const salePrice = price * Math.pow(1 + appr, years)
      const paid = monthlyPay * Math.min(loanMonths, years * 12)
      const loanBalance = Math.max(0, loan + loan * loanRate * (years) - paid)   // تقریبِ ماندهٔ وام
      cf += salePrice - loanBalance
    }
    cashflows.push(Math.round(cf))
  }
  const totalReturn = cashflows.reduce((a, b) => a + b, 0)
  const capRate = price ? Math.round((rent * 12 * (1 - exp) / price) * 1000) / 10 : 0
  const r = irr(cashflows)
  return {
    roi: roi(totalReturn, down), irr: isNaN(r) ? null : Math.round(r * 1000) / 10, npv: Math.round(npv(0.25, cashflows)),
    paybackYears: paybackPeriod(cashflows), rentalYield: rentalYield(rent * 12, price), capRate,
    monthlyCashflow: Math.round(annualNet / 12), cashflows,
    note: annualNet >= 0 ? 'جریانِ نقدیِ مثبت — پوششِ اقساط با اجاره' : 'جریانِ نقدیِ منفی — نیازمندِ آوردهٔ ماهانه',
  }
}

// ── تحلیلِ پروژهٔ ساخت‌وساز (سازنده) ──
export interface ProjectInput { landCost: number; buildCostPerM: number; totalArea: number; sellPricePerM: number; months?: number; preSaleRate?: number }
export function analyzeConstruction(inp: ProjectInput) {
  const buildCost = (inp.buildCostPerM || 0) * (inp.totalArea || 0)
  const totalCost = (inp.landCost || 0) + buildCost
  const revenue = (inp.sellPricePerM || 0) * (inp.totalArea || 0)
  const profit = revenue - totalCost
  const margin = revenue ? Math.round((profit / revenue) * 1000) / 10 : 0
  const months = Math.max(1, inp.months || 24)
  const annualized = totalCost ? Math.round((Math.pow(1 + profit / totalCost, 12 / months) - 1) * 1000) / 10 : 0
  // ریسک: حاشیهٔ کم + مدتِ طولانی + پیش‌فروشِ پایین = ریسکِ بالا.
  const risk = clamp01(0.5 * (1 - clamp01(margin / 40)) + 0.3 * clamp01(months / 48) + 0.2 * (1 - clamp01(inp.preSaleRate ?? 0.3)))
  return {
    totalCost, buildCost, revenue, profit, margin, annualizedReturn: annualized,
    yieldPct: totalCost ? Math.round((profit / totalCost) * 1000) / 10 : 0,
    risk: Math.round(risk * 100), riskLabel: risk < 0.35 ? 'کم' : risk < 0.6 ? 'متوسط' : 'بالا',
  }
}
function clamp01(x: number): number { return Math.max(0, Math.min(1, x)) }
