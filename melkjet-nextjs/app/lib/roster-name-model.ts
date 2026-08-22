// دسته‌بندِ نامِ مشاور — یادگیرندهٔ خودمان، بدونِ هیچ مدلِ بیرونی در زمانِ تصمیم.
// چرا لازم شد: هیچ قاعدهٔ تک‌عددی جواب نمی‌دهد. «تک واحدی» نسبتِ امضا ۰.۰۰ دارد و
// «کاظمی» ۰.۹۵ — ولی «امورملکی» هم ۰.۹۰ دارد (عنوانِ شغلی است) و «سعیدی» ۰.۰۳
// (نامِ خیابان هم هست). فقط ترکیبِ ویژگی‌ها تفکیک می‌کند، و وزن‌ها باید یاد گرفته شوند.
import { kvGet, kvSet } from './db'
import { keyOf, STOPWORDS } from './agency-name-lexicon'

export const MODEL_KV = 'roster_name_model'
const SIG = /(کارشناس|مشاور|فروشنده|با احترام|با تشکر|هماهنگی|راهنمایی|جهت تماس|امضا)/
// بلافاصله پس از کلیدواژهٔ امضا («مشاور فروش: محمدی») — قوی‌ترین سیگنالِ نام.
const KEYRE = /(?:کارشناسِ?\s*فروش|مشاورِ?\s*فروش|کارشناس|مشاور|فروشنده|با\s*احترام|جهتِ?\s*هماهنگی|جهتِ?\s*راهنمایی|جهتِ?\s*تماس|امضا)/
// بلافاصله پس از نشانهٔ آدرس («سهروردی شمالی» بعد از «خیابان») — نامِ معبر است، نه آدم.
const ADDRRE = /(?:خیابان|کوچه|بلوار|نبش|میدان|بین|شهرک|فاز|منطقه|پلاک|انتهای|ابتدای|جنب|روبروی)/
const SUFFIX = /(?:زاده|نژاد|پور|یان|فرد|منش|مهر|راد|نیا|لو|فر|مند|خواه|طلب|دوست|بخش|ی)$/

export const norm = (s: string) => String(s || '')
  .replace(/\u200c/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim()

export interface CorpusStat { b: number; s: number; ag: number; k: number; a: number }
export type Corpus = Map<string, CorpusStat>

/** آمارِ پیکره از متنِ آگهی‌ها: ظهور در بدنه، ظهور در خطِ امضا، و پراکندگی بینِ آژانس‌ها. */
export function buildCorpus(docs: { id: string; desc: string }[]): Corpus {
  const B = new Map<string, { df: number; ag: Set<string> }>()
  const S = new Map<string, number>()
  const K = new Map<string, number>(), A = new Map<string, number>()
  const toks = (line: string) => {
    const ws = norm(line).split(/[^\u0621-\u06ccA-Za-z]+/).filter(w => w.length > 1)
    const o = new Set<string>()
    for (let i = 0; i < ws.length; i++) { o.add(ws[i]); if (i + 1 < ws.length) o.add(ws[i] + ' ' + ws[i + 1]) }
    return o
  }
  for (const d of docs) {
    const bs = new Set<string>(), ss = new Set<string>()
    const ks = new Set<string>(), as = new Set<string>()
    for (const line of String(d.desc || '').split(/[\n\r]+/)) {
      const t = toks(line); const tgt = SIG.test(line) ? ss : bs
      for (const x of t) tgt.add(x)
      const mk = line.match(KEYRE)
      if (mk) for (const x of toks(line.slice((mk.index || 0) + mk[0].length, (mk.index || 0) + mk[0].length + 40))) ks.add(x)
      const ma = line.match(ADDRRE)
      if (ma) for (const x of toks(line.slice((ma.index || 0) + ma[0].length, (ma.index || 0) + ma[0].length + 40))) as.add(x)
    }
    for (const x of ks) K.set(x, (K.get(x) || 0) + 1)
    for (const x of as) A.set(x, (A.get(x) || 0) + 1)
    for (const x of bs) { let e = B.get(x); if (!e) { e = { df: 0, ag: new Set() }; B.set(x, e) } e.df++; e.ag.add(d.id) }
    for (const x of ss) S.set(x, (S.get(x) || 0) + 1)
  }
  const out: Corpus = new Map()
  const keys = new Set([...B.keys(), ...S.keys(), ...K.keys(), ...A.keys()])
  for (const k of keys) out.set(k, { b: B.get(k)?.df || 0, s: S.get(k) || 0, ag: B.get(k)?.ag.size || 0,
    k: K.get(k) || 0, a: A.get(k) || 0 })
  return out
}

export const FEATURES = ['bias', 'logB', 'logS', 'sigRatio', 'agSpread', 'tokens', 'hasStop', 'suffix', 'nonLetter', 'afterKey', 'afterAddr'] as const

/** بردارِ ویژگیِ یک کاندیدا. هیچ ویژگی‌ای به‌تنهایی تصمیم‌گیر نیست — وزن‌ها یاد گرفته می‌شوند. */
export function featurize(name: string, c: Corpus): number[] {
  const k = norm(name)
  const st = c.get(k) || { b: 0, s: 0, ag: 0, k: 0, a: 0 }
  const ws = k.split(' ').filter(Boolean)
  return [
    1,
    Math.log1p(st.b) / 8,
    Math.log1p(st.s) / 8,
    st.s / (st.s + st.b + 1),
    Math.min(1, st.ag / 40),
    Math.min(1, ws.length / 3),
    ws.some(w => STOPWORDS.has(w) || STOPWORDS.has(keyOf(w))) ? 1 : 0,
    SUFFIX.test(ws[ws.length - 1] || '') ? 1 : 0,
    /[^\u0621-\u06ccA-Za-z ]/.test(k) ? 1 : 0,
    st.k / (st.k + st.b + 1),
    st.a / (st.a + st.k + 1),
  ]
}

export interface ModelW { w: number[]; trainedAt: number; n: number; metrics?: Record<string, number> }

let CACHE: ModelW | null = null
export async function loadModel(): Promise<ModelW | null> {
  if (CACHE) return CACHE
  const m = await kvGet<ModelW | null>(MODEL_KV, null)
  if (m && Array.isArray(m.w) && m.w.length === FEATURES.length) CACHE = m
  return CACHE
}
export async function saveModel(m: ModelW): Promise<void> { CACHE = m; await kvSet(MODEL_KV, m) }

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))
export const score = (x: number[], w: number[]) => sigmoid(x.reduce((s, v, i) => s + v * (w[i] || 0), 0))

/** احتمالِ اینکه این رشته نامِ یک آدم باشد. اگر مدل هنوز آموزش ندیده، null. */
export async function nameProb(candidate: string, c: Corpus): Promise<number | null> {
  const m = await loadModel()
  if (!m) return null
  return score(featurize(candidate, c), m.w)
}

/** رگرسیونِ لجستیک با گرادیانِ دسته‌ای + L2. کوچک و شفاف؛ عمداً هیچ وابستگیِ بیرونی ندارد. */
export function train(
  X: number[][], y: number[],
  opts: { epochs?: number; lr?: number; l2?: number } = {},
): number[] {
  const epochs = opts.epochs ?? 400, lr = opts.lr ?? 0.6, l2 = opts.l2 ?? 0.01
  const d = X[0]?.length || FEATURES.length
  const w = new Array(d).fill(0)
  // وزنِ کلاس‌ها متوازن می‌شود: منفی‌های خودکار هزاران‌تا و مثبت‌ها صدتا هستند.
  const nPos = y.reduce((s, v) => s + v, 0), nNeg = y.length - nPos
  const wPos = nPos ? y.length / (2 * nPos) : 1, wNeg = nNeg ? y.length / (2 * nNeg) : 1
  for (let e = 0; e < epochs; e++) {
    const g = new Array(d).fill(0)
    for (let i = 0; i < X.length; i++) {
      const p = score(X[i], w), cw = y[i] ? wPos : wNeg, err = (p - y[i]) * cw
      for (let j = 0; j < d; j++) g[j] += err * X[i][j]
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (g[j] / X.length + (j ? l2 * w[j] : 0))
  }
  return w
}

/** سنجشِ مدل روی دادهٔ کنارگذاشته‌شده — بدونِ این عدد، وصل‌کردنِ مدل قمار است. */
export function evaluate(X: number[][], y: number[], w: number[], thr = 0.5) {
  let tp = 0, fp = 0, tn = 0, fn = 0
  for (let i = 0; i < X.length; i++) {
    const p = score(X[i], w) >= thr ? 1 : 0
    if (p === 1 && y[i] === 1) tp++
    else if (p === 1 && y[i] === 0) fp++
    else if (p === 0 && y[i] === 0) tn++
    else fn++
  }
  const prec = tp / (tp + fp || 1), rec = tp / (tp + fn || 1)
  return { tp, fp, tn, fn, precision: +prec.toFixed(3), recall: +rec.toFixed(3),
    f1: +(2 * prec * rec / (prec + rec || 1)).toFixed(3),
    accuracy: +((tp + tn) / (X.length || 1)).toFixed(3) }
}

export const CORPUS_KV = 'roster_name_corpus'
/** آستانهٔ پذیرش. زیرِ این عدد، کاندیدا نامِ آدم شمرده نمی‌شود. */
export const NAME_THRESHOLD = 0.6

let CORPUS: Corpus | null = null

/** پیکرهٔ هرس‌شده برای KV: دُمِ بلندِ عبارت‌های یک‌باره حذف می‌شود (۱۴۷هزار → چند ده‌هزار). */
export function pruneCorpus(c: Corpus, min = 3): Record<string, number[]> {
  const o: Record<string, number[]> = {}
  for (const [k, v] of c) if (v.b + v.s + v.k >= min) o[k] = [v.b, v.s, v.ag, v.k, v.a]
  return o
}
export async function saveCorpus(c: Corpus): Promise<number> {
  const o = pruneCorpus(c)
  await kvSet(CORPUS_KV, o)
  CORPUS = c
  return Object.keys(o).length
}

/** بارگذاریِ یک‌بارهٔ مدل و پیکره. اگر مدل آموزش ندیده باشد false برمی‌گرداند
 *  و مسیرِ استخراج مثلِ قبل کار می‌کند — یعنی وصل‌شدنِ مدل هیچ‌وقت چیزی را نمی‌شکند. */
export async function primeNameModel(): Promise<boolean> {
  await loadModel()
  if (!CACHE) return false
  if (!CORPUS) {
    const o = await kvGet<Record<string, number[]>>(CORPUS_KV, {})
    const m: Corpus = new Map()
    for (const key in o) { const a = o[key]; m.set(key, { b: a[0] || 0, s: a[1] || 0, ag: a[2] || 0, k: a[3] || 0, a: a[4] || 0 }) }
    CORPUS = m
  }
  return true
}

/** نمرهٔ همگام — `extractSignature` همگام است و نمی‌تواند await کند.
 *  null یعنی مدل/پیکره آماده نیست؛ در آن حالت تصمیم به دروازه‌های قبلی واگذار می‌شود. */
export function nameProbSync(name: string): number | null {
  if (!CORPUS || !CACHE) return null
  return score(featurize(name, CORPUS), CACHE.w)
}

/** چند بار این عبارت در پیکره دیده شده. صفر یعنی «کمیاب» — و مدل به کمیاب
 *  نمرهٔ بالا می‌دهد چون بسامد و پراکندگی‌اش صفر است. برای همین در انتخابِ بینِ
 *  دوواژه و تک‌واژه، این عدد داور است نه نمرهٔ مدل. */
export function corpusCount(name: string): number {
  if (!CORPUS) return 0
  const st = CORPUS.get(norm(name))
  return st ? st.b + st.s + st.k : 0
}

/** دسترسی به پیکرهٔ بارگذاری‌شده برای ماژولِ برچسب‌زنِ توکن. */
export function getCorpus(): Corpus | null { return CORPUS }
