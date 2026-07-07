// REOS v3 · Learning-to-Rank — رتبه‌بندیِ زوجی (pairwise) به‌جای امتیازدهیِ نقطه‌ای.
// یاد می‌گیرد وزنی پیدا کند که score(مرتبط‌تر) > score(کم‌ربط‌تر) — همان ایدهٔ LambdaMART/RankNet
// در فرمِ خطیِ سبک (بدونِ وابستگی). خالص و تست‌پذیر؛ کیفیت با nDCG سنجیده می‌شود.
export interface RankItem { features: number[]; relevance: number }   // relevance بالاتر = بهتر

export function rankScore(features: number[], w: number[]): number {
  let s = 0; for (let i = 0; i < w.length; i++) s += (features[i] || 0) * w[i]; return s
}
function sigmoid(z: number): number { return 1 / (1 + Math.exp(-z)) }

// آموزشِ زوجی: برای هر کوئری، همهٔ جفت‌های (i بهتر از j) را با گرادیانِ RankNet آپدیت می‌کند.
export function fitPairwise(
  queries: RankItem[][],
  opts: { dim: number; epochs?: number; lr?: number; l2?: number } ,
): number[] {
  const { dim } = opts, epochs = opts.epochs ?? 300, lr = opts.lr ?? 0.1, l2 = opts.l2 ?? 1e-4
  let w = new Array(dim).fill(0)
  for (let e = 0; e < epochs; e++) {
    const grad = new Array(dim).fill(0); let pairs = 0
    for (const q of queries) {
      for (let i = 0; i < q.length; i++) for (let j = 0; j < q.length; j++) {
        if (q[i].relevance <= q[j].relevance) continue     // فقط جفتِ (i بهتر از j)
        const si = rankScore(q[i].features, w), sj = rankScore(q[j].features, w)
        const p = sigmoid(si - sj)                          // احتمالِ درست‌بودنِ ترتیب
        const g = (p - 1)                                    // مشتقِ loss نسبت به (si - sj)
        for (let d = 0; d < dim; d++) grad[d] += g * ((q[i].features[d] || 0) - (q[j].features[d] || 0))
        pairs++
      }
    }
    if (!pairs) break
    for (let d = 0; d < dim; d++) w[d] -= lr * (grad[d] / pairs + l2 * w[d])
  }
  return w.map(x => Math.round(x * 10000) / 10000)
}

// مرتب‌سازیِ آیتم‌ها با وزنِ آموخته‌شده (خروجی: شناسه‌ها/اندیس‌ها به‌ترتیبِ نزولیِ امتیاز).
export function rankItems<T extends { features: number[] }>(items: T[], w: number[]): T[] {
  return [...items].sort((a, b) => rankScore(b.features, w) - rankScore(a.features, w))
}
