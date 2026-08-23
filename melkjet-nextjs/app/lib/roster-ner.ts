// برچسب‌زنِ توکنِ نامِ مشاور — جایگزینِ «دسته‌بندیِ رشته».
//
// چرا بازنویسی شد: مدلِ قبلی می‌پرسید «آیا رشتهٔ X نام است؟» و فقط از آمارِ سراسری
// جواب می‌داد. برای همین «لطفی هستم» را نام می‌دید و «مرادی» را در «کارشناس املاک :
// مرادی» نمی‌دید — و ما مجبور بودیم جای ویژگیِ گم‌شده قاعده بگذاریم. سؤالِ درست
// این است: «در این متن کدام توکن نامِ مشاور است؟» که جوابش به بافتِ محلی بستگی دارد.
//
// برچسب‌ها از دادهٔ خودمان می‌آیند: ۲۲۳ مشاورِ فارغ‌التحصیل (نامِ تأییدشدهٔ مدیر +
// شماره + فهرستِ توکنِ آگهی‌ها). در هر آگهی، توکنِ برابر با آن نام مثبت است و بقیهٔ
// توکن‌های ناحیهٔ امضا منفی. هر تأییدِ تازهٔ مدیر خودکار به دادهٔ آموزشی اضافه می‌شود.
import { kvGet, kvSet } from './db'
import { deEmoji, keyOf, isNoiseWord } from './agency-name-lexicon'
import { getCorpus, norm, type Corpus } from './roster-name-model'

export const NER_KV = 'roster_ner_model'
const KEYW = /(کارشناس|مشاور|فروشنده|املاک|مسکن|امضا|احترام|تشکر|هماهنگی|راهنمایی|تماس)/
const SUFFIX = /(?:زاده|نژاد|پور|یان|فرد|منش|مهر|راد|نیا|لو|فر|مند|خواه|طلب|دوست|بخش|ی)$/
// صورتِ فعلی: «بزارید» از «شماره‌تون رو بزارید»، «بگیرید» از «تماس بگیرید».
// نامِ آدم پیشوندِ ب/می/ن با پایانِ ید/ند/یم ندارد. ویژگی است، نه دروازه.
const VERBISH = /^(?:ب|می|نمی|ن)[\u0621-\u06cc]{2,}(?:ید|ند|یم)$|(?:ایید|یید|مایید)$/

export interface Tok { w: string; line: number; iDoc: number; iLine: number; keyDist: number; sigLine: boolean }

/** توکن‌های ناحیهٔ جست‌وجو: خطوطِ دارای کلیدواژه + سه خطِ پایانی. همان ناحیه‌ای که
 *  در آموزش و در استنتاج استفاده می‌شود، وگرنه توزیعِ ویژگی‌ها جابه‌جا می‌شود. */
export function tokenize(desc: string): { toks: Tok[]; nLines: number; nDoc: number } {
  const lines = deEmoji(String(desc || '')).split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
  const toks: Tok[] = []
  let iDoc = 0
  lines.forEach((line, li) => {
    const sigLine = KEYW.test(line)
    const parts = line.split(/([^\u0621-\u06ccA-Za-z]+)/)
    let keyDist = 99, iLine = 0
    for (const p of parts) {
      if (!/[\u0621-\u06ccA-Za-z]/.test(p)) continue
      if (KEYW.test(p)) { keyDist = 0 } else if (keyDist < 99) keyDist++
      if (p.length > 1) {
        if (sigLine || li >= lines.length - 3) toks.push({ w: p, line: li, iDoc, iLine, keyDist, sigLine })
        iLine++
      }
      iDoc++
    }
  })
  return { toks, nLines: lines.length, nDoc: Math.max(1, iDoc) }
}

export const NER_FEATURES = [
  'bias', 'logB', 'logS', 'sigRatio', 'agSpread', 'afterKey', 'afterAddr',
  'keyNear', 'inSigLine', 'posDoc', 'lineFromEnd', 'prevKey',
  'nextB', 'nextSig', 'prevSig', 'suffix', 'lenNorm', 'inTitle', 'repeat', 'noiseWord', 'verbish',
] as const

const ST = (c: Corpus | null, w: string) => c?.get(norm(w)) || { b: 0, s: 0, ag: 0, k: 0, a: 0 }

/** بردارِ ویژگیِ یک توکن در بافتِ خودش. هیچ قاعده‌ای اینجا نیست — فقط اندازه‌گیری. */
export function featsOf(
  toks: Tok[], i: number, nLines: number, nDoc: number, titleSet: Set<string>, c: Corpus | null,
): number[] {
  const t = toks[i]
  const st = ST(c, t.w)
  const prev = i > 0 ? toks[i - 1] : null
  const next = i + 1 < toks.length ? toks[i + 1] : null
  const stPrev = prev ? ST(c, prev.w) : { b: 0, s: 0, ag: 0, k: 0, a: 0 }
  const stNext = next ? ST(c, next.w) : { b: 0, s: 0, ag: 0, k: 0, a: 0 }
  const rep = toks.filter(x => x.w === t.w).length
  return [
    1,
    Math.log1p(st.b) / 8,
    Math.log1p(st.s) / 8,
    st.s / (st.s + st.b + 1),
    Math.min(1, st.ag / 40),
    st.k / (st.k + st.b + 1),
    st.a / (st.a + st.k + 1),
    t.keyDist >= 99 ? 0 : Math.max(0, 1 - t.keyDist / 6),   // نزدیکیِ توکنی به کلیدواژه
    t.sigLine ? 1 : 0,
    t.iDoc / nDoc,                                          // نام معمولاً انتهای متن است
    Math.max(0, 1 - (nLines - 1 - t.line) / 5),
    prev && KEYW.test(prev.w) ? 1 : 0,
    Math.log1p(stNext.b) / 8,                               // «لطفی هستم»: بعدی خیلی پرتکرار
    stNext.s / (stNext.s + stNext.b + 1),
    stPrev.s / (stPrev.s + stPrev.b + 1),
    SUFFIX.test(t.w) ? 1 : 0,
    Math.min(1, t.w.length / 10),
    titleSet.has(keyOf(t.w)) ? 1 : 0,                       // نام در عنوان نمی‌آید
    Math.min(1, rep / 3),
    isNoiseWord(t.w) ? 1 : 0,                               // ویژگی است، نه دروازه
    VERBISH.test(t.w) ? 1 : 0,
  ]
}

export const titleTokens = (title: string) =>
  new Set(deEmoji(String(title || '')).split(/[^\u0621-\u06ccA-Za-z]+/).filter(Boolean).map(keyOf))

export interface NerModel { w: number[]; trainedAt: number; n: number; metrics?: Record<string, number> }
let NER: NerModel | null = null
export async function loadNer(): Promise<NerModel | null> {
  if (NER) return NER
  const m = await kvGet<NerModel | null>(NER_KV, null)
  if (m && Array.isArray(m.w) && m.w.length === NER_FEATURES.length) NER = m
  return NER
}
export async function saveNer(m: NerModel) { NER = m; await kvSet(NER_KV, m) }

const sig = (z: number) => 1 / (1 + Math.exp(-z))
export const dot = (x: number[], w: number[]) => sig(x.reduce((s, v, i) => s + v * (w[i] || 0), 0))

export function trainNer(X: number[][], y: number[], epochs = 500, lr = 0.5, l2 = 0.01): number[] {
  const d = X[0]?.length || NER_FEATURES.length
  const w = new Array(d).fill(0)
  const nPos = y.reduce((s, v) => s + v, 0), nNeg = y.length - nPos
  const wP = nPos ? y.length / (2 * nPos) : 1, wN = nNeg ? y.length / (2 * nNeg) : 1
  for (let e = 0; e < epochs; e++) {
    const g = new Array(d).fill(0)
    for (let i = 0; i < X.length; i++) {
      const p = dot(X[i], w), err = (p - y[i]) * (y[i] ? wP : wN)
      for (let j = 0; j < d; j++) g[j] += err * X[i][j]
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (g[j] / X.length + (j ? l2 * w[j] : 0))
  }
  return w
}

export const NER_THRESHOLD = 0.55

/** نامِ مشاورِ این آگهی، یا خالی. نامِ دوبخشی وقتی ساخته می‌شود که توکنِ همسایه هم
 *  نمرهٔ بالایی داشته باشد — نه با قاعده، بلکه با همان نمرهٔ مدل. */
export function bestName(title: string, desc: string): { name: string; p: number } | null {
  const m = NER
  if (!m) return null
  const c = getCorpus()
  const { toks, nLines, nDoc } = tokenize(desc)
  if (!toks.length) return null
  const ts = titleTokens(title)
  const scores = toks.map((_, i) => dot(featsOf(toks, i, nLines, nDoc, ts, c), m.w))
  let bi = 0
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[bi]) bi = i
  if (scores[bi] < NER_THRESHOLD) return null

  // همسایهٔ چسبیده در همان خط، اگر آن هم نمرهٔ بالایی دارد → نامِ دوبخشی
  const near = (j: number) => j >= 0 && j < toks.length && toks[j].line === toks[bi].line &&
    Math.abs(toks[j].iLine - toks[bi].iLine) === 1 && scores[j] >= NER_THRESHOLD * 0.8
  let name = toks[bi].w
  if (near(bi + 1) && (!near(bi - 1) || scores[bi + 1] >= scores[bi - 1])) name = toks[bi].w + ' ' + toks[bi + 1].w
  else if (near(bi - 1)) name = toks[bi - 1].w + ' ' + toks[bi].w
  return { name, p: scores[bi] }
}
