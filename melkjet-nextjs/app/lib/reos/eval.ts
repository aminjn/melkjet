// REOS v3 · Offline Evaluation — سنجه‌های کیفیتِ رتبه‌بندی/توصیه (بدونِ نیاز به شبکه).
// recall@k · precision@k · nDCG@k · MRR + هارنسِ ارزیابیِ آفلاین روی مجموعهٔ (توصیه، مرتبط‌ها).
export function recallAtK(recommended: string[], relevant: Set<string> | string[], k: number): number {
  const rel = relevant instanceof Set ? relevant : new Set(relevant)
  if (!rel.size) return 0
  const top = recommended.slice(0, k)
  let hit = 0; for (const id of top) if (rel.has(id)) hit++
  return Math.round((hit / rel.size) * 1000) / 1000
}
export function precisionAtK(recommended: string[], relevant: Set<string> | string[], k: number): number {
  const rel = relevant instanceof Set ? relevant : new Set(relevant)
  const top = recommended.slice(0, k); if (!top.length) return 0
  let hit = 0; for (const id of top) if (rel.has(id)) hit++
  return Math.round((hit / top.length) * 1000) / 1000
}
export function mrr(recommended: string[], relevant: Set<string> | string[]): number {
  const rel = relevant instanceof Set ? relevant : new Set(relevant)
  for (let i = 0; i < recommended.length; i++) if (rel.has(recommended[i])) return Math.round((1 / (i + 1)) * 1000) / 1000
  return 0
}
// nDCG با درجهٔ ارتباطِ دلخواه (relevanceOf) — پیش‌فرض باینری.
export function ndcgAtK(recommended: string[], relevanceOf: (id: string) => number, k: number): number {
  const top = recommended.slice(0, k)
  let dcg = 0; for (let i = 0; i < top.length; i++) { const g = relevanceOf(top[i]); dcg += g / Math.log2(i + 2) }
  const ideal = top.map(relevanceOf).sort((a, b) => b - a)
  let idcg = 0; for (let i = 0; i < ideal.length; i++) idcg += ideal[i] / Math.log2(i + 2)
  return idcg ? Math.round((dcg / idcg) * 1000) / 1000 : 0
}

export interface EvalCase { recommended: string[]; relevant: string[] }
export function evaluateRankings(cases: EvalCase[], k = 10): { recall: number; precision: number; ndcg: number; mrr: number; n: number } {
  if (!cases.length) return { recall: 0, precision: 0, ndcg: 0, mrr: 0, n: 0 }
  let rec = 0, prec = 0, nd = 0, mr = 0
  for (const c of cases) {
    const rel = new Set(c.relevant)
    rec += recallAtK(c.recommended, rel, k)
    prec += precisionAtK(c.recommended, rel, k)
    nd += ndcgAtK(c.recommended, id => (rel.has(id) ? 1 : 0), k)
    mr += mrr(c.recommended, rel)
  }
  const n = cases.length
  return { recall: Math.round((rec / n) * 1000) / 1000, precision: Math.round((prec / n) * 1000) / 1000, ndcg: Math.round((nd / n) * 1000) / 1000, mrr: Math.round((mr / n) * 1000) / 1000, n }
}
