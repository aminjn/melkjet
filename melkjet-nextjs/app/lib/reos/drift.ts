// REOS v3 · Feature Drift Monitoring — PSI (Population Stability Index) برای پایشِ رانشِ ویژگی.
// مقایسهٔ توزیعِ یک ویژگی بینِ خط‌مبنا (baseline) و پنجرهٔ فعلی → هشدارِ data/feature drift.
export function histogram(values: number[], edges: number[]): number[] {
  const counts = new Array(edges.length + 1).fill(0)
  for (const v of values) {
    let b = 0; while (b < edges.length && v >= edges[b]) b++
    counts[b]++
  }
  const total = values.length || 1
  return counts.map(c => c / total)
}
// لبه‌های یکنواخت بینِ min و max (nBins سطل).
export function uniformEdges(min: number, max: number, nBins = 10): number[] {
  if (max <= min) return [min]
  const step = (max - min) / nBins, edges: number[] = []
  for (let i = 1; i < nBins; i++) edges.push(min + step * i)
  return edges
}

// PSI = Σ (a_i − e_i) · ln(a_i / e_i). با هموارسازیِ کوچک برای جلوگیری از log(0).
export function psi(expected: number[], actual: number[], edges: number[]): number {
  const e = histogram(expected, edges), a = histogram(actual, edges)
  let s = 0
  for (let i = 0; i < e.length; i++) {
    const ei = Math.max(1e-4, e[i]), ai = Math.max(1e-4, a[i])
    s += (ai - ei) * Math.log(ai / ei)
  }
  return Math.round(s * 1000) / 1000
}
export function driftLevel(psiValue: number): 'stable' | 'moderate' | 'significant' {
  const p = Math.abs(psiValue)
  return p < 0.1 ? 'stable' : p < 0.25 ? 'moderate' : 'significant'
}

// راحتی: PSIِ دو نمونه با سطل‌بندیِ خودکار از دامنهٔ خط‌مبنا.
export function driftReport(baseline: number[], current: number[], nBins = 10): { psi: number; level: 'stable' | 'moderate' | 'significant' } {
  if (!baseline.length || !current.length) return { psi: 0, level: 'stable' }
  const edges = uniformEdges(Math.min(...baseline), Math.max(...baseline), nBins)
  const p = psi(baseline, current, edges)
  return { psi: p, level: driftLevel(p) }
}
