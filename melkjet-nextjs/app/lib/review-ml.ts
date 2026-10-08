import { join } from 'path'
import { kvGet, kvMutate, pgEnabled } from './db'
import { readJsonCached, writeJsonCached } from './json-file'
import { FA_DIGITS, faDigit } from './digits'

// ─── فاز ۲۹۷ک — ممیزیِ نظرات با ماشین‌لرنینگِ خودی، نه AIِ پولی ─────────────────────
// خواستِ صریح: «قرار بود همه رو ماشین‌لرنینگ انجام بده نه هوش مصنوعی». این ماژول همان
// فلسفهٔ موتورِ نامِ رُستر را روی نظرات پیاده می‌کند:
//  ۱) قواعدِ «قطعی» برای مدرکِ بی‌چون‌وچرا (شماره‌تلفن/لینک/آیدیِ تبلیغاتی/فحش) — بدونِ مدل.
//  ۲) یادگیرندهٔ سبک (نایو بیزِ با هشِ ویژگی) که از داوری‌های واقعیِ ادمین/مالک یاد می‌گیرد
//     و فقط وقتی «به‌قدرِ کافی دیده و مطمئن است» حکم می‌دهد.
//  ۳) هر چیزِ مبهم → «در انتظارِ بررسی» — هیچ حدسی منتشر نمی‌شود.
// هیچ فراخوانِ شبکه/AI در کار نیست؛ تمام‌شدنِ اعتبارِ گپ دیگر روی نظرات هیچ اثری ندارد.

export interface ReviewVerdict { verdict: 'approve' | 'reject' | 'review'; reason: string }

// ── مدل: شمارش‌های نایو بیز روی فضای هش‌شدهٔ ویژگی‌ها (کلمه + سه‌نگارهٔ نویسه‌ای) ──
const DIM = 4096
const MIN_SAMPLES = 40    // تا این تعداد داوریِ واقعی، مدل ساکت است (قاعده‌ها کار می‌کنند)
const MIN_MARGIN = 3      // حاشیهٔ اطمینانِ لگاریتمی — کمتر از این یعنی «مطمئن نیستم»
interface MLDoc { nPos: number; nNeg: number; pos: Record<string, number>; neg: Record<string, number> }
const EMPTY: MLDoc = { nPos: 0, nNeg: 0, pos: {}, neg: {} }
const KV = 'review_ml'
const FILE = join(process.cwd(), '.review-ml.json')

async function loadModel(): Promise<MLDoc> {
  if (pgEnabled()) return kvGet<MLDoc>(KV, { ...EMPTY, pos: {}, neg: {} })
  return readJsonCached<MLDoc>(FILE, { ...EMPTY, pos: {}, neg: {} })
}

function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % DIM }
function features(text: string): number[] {
  const t = norm(text)
  const out: number[] = []
  for (const w of t.split(/\s+/).filter(Boolean).slice(0, 60)) out.push(hash('w:' + w))
  const flat = t.replace(/\s+/g, '')
  for (let i = 0; i + 3 <= flat.length && out.length < 220; i++) out.push(hash('g:' + flat.slice(i, i + 3)))
  return out
}

function norm(s: string): string {
  return String(s || '').replace(FA_DIGITS, faDigit)
    .replace(/[يك]/g, c => (c === 'ي' ? 'ی' : 'ک'))
    .replace(/[‌‏‎]/g, ' ')
    // کشیدگیِ احساسی («عالییییی») ویژگی نیست — پیش از هر تحلیلی جمع می‌شود.
    .replace(/(.)\1{2,}/g, '$1$1')
    .toLowerCase().trim()
}

/** یادگیری از یک داوریِ واقعی (تاییدِ ادمین/مالک = مثبت؛ رد/حذف = منفی). ارزان و اتمی. */
export async function learnReview(text: string, approved: boolean): Promise<void> {
  const fs = features(text)
  if (!fs.length) return
  const apply = (m: MLDoc) => {
    const bag = approved ? m.pos : m.neg
    for (const f of fs) bag[f] = (bag[f] || 0) + 1
    if (approved) m.nPos++; else m.nNeg++
    return m
  }
  try {
    if (pgEnabled()) await kvMutate<MLDoc, MLDoc>(KV, { ...EMPTY, pos: {}, neg: {} }, apply)
    else writeJsonCached(FILE, apply(readJsonCached<MLDoc>(FILE, { ...EMPTY, pos: {}, neg: {} })), true)
  } catch { /* یادنگرفتن فاجعه نیست؛ داوریِ بعدی دوباره می‌آموزد */ }
}

function mlScore(m: MLDoc, fs: number[]): number {
  // log P(approve|x) − log P(reject|x) با هموارسازیِ لاپلاس
  let s = Math.log((m.nPos + 1) / (m.nNeg + 1))
  for (const f of fs) s += Math.log(((m.pos[f] || 0) + 1) / (m.nPos + DIM)) - Math.log(((m.neg[f] || 0) + 1) / (m.nNeg + DIM))
  return s
}

// ── قواعدِ قطعی — مدرکِ عینی، نه سلیقه ──
const AD_RE = /https?:|www\.|t\.me|wa\.me|@[a-z0-9_]{4,}|تلگرام|اینستاگرام|واتساپ|اینستا/i
const INSULTS = ['کلاهبردار', 'دزد', 'بی‌شرف', 'بیشرف', 'احمق', 'عوضی', 'آشغال', 'کثافت', 'لاشی', 'حرومی']

/** داوریِ یک نظر — خالص و هم‌زمان‌تست‌پذیر؛ بدونِ هیچ فراخوانِ AI. */
export async function classifyReview(name: string, text: string): Promise<ReviewVerdict> {
  const t = norm(text)
  const digits = t.replace(/\D/g, '')
  if (digits.length >= 8) return { verdict: 'reject', reason: 'شمارهٔ تماس داخلِ متنِ نظر (تبلیغ/دورزدن)' }
  if (AD_RE.test(t) || AD_RE.test(norm(name))) return { verdict: 'reject', reason: 'لینک یا آیدیِ تبلیغاتی در نظر' }
  const hit = INSULTS.find(w => t.includes(w))
  if (hit) return { verdict: 'review', reason: `واژهٔ تندِ «${hit}» — بررسیِ انسانی (شاید شکایتِ واقعی باشد)` }

  const words = t.split(/\s+/).filter(Boolean)

  // یادگیرنده: فقط وقتی به‌قدرِ کافی داوریِ واقعی دیده و مطمئن است.
  try {
    const m = await loadModel()
    if (m.nPos + m.nNeg >= MIN_SAMPLES) {
      const s = mlScore(m, features(text))
      if (s >= MIN_MARGIN) return { verdict: 'approve', reason: `ML: مشابهِ نظراتِ تاییدشدهٔ قبلی (${m.nPos + m.nNeg} داوریِ آموخته)` }
      if (s <= -MIN_MARGIN) return { verdict: 'reject', reason: `ML: مشابهِ نظراتِ ردشدهٔ قبلی (${m.nPos + m.nNeg} داوریِ آموخته)` }
    }
  } catch { /* بدونِ مدل، قاعده‌ها تصمیم می‌گیرند */ }

  // متنِ کوتاه/تک‌کلمه/بی‌ساختار («بلبلطرز…») خودکار منتشر نمی‌شود — به داوریِ انسان.
  if (words.length < 3 || t.length < 15) return { verdict: 'review', reason: 'متنِ کوتاه یا بی‌ساختار — در انتظارِ بررسی' }
  return { verdict: 'approve', reason: 'متنِ سالم (قواعدِ ML — بدونِ شماره/لینک/الفاظِ نامناسب)' }
}
