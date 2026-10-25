import { NextRequest, NextResponse } from 'next/server'
import { aiFor, agentModel, agentProvider , fallbackModel } from '@/app/lib/gapgpt'
import { mlFirst } from '@/app/lib/ml-gateway'
const { chatCompleteSafe } = aiFor('امتیازدهیِ ملک')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

export const dynamic = 'force-dynamic'

// امتیازدهی و تحلیلِ زندهٔ آگهی/پروژه هنگامِ ثبت — تا کاربر بهترین آگهی/پروژه را بسازد.
export interface ScoreResult {
  score: number; level: string
  strengths: string[]; suggestions: string[]; missing: string[]
}
function stripFence(s: string): string { const m = s.match(/\{[\s\S]*\}/); return m ? m[0] : s }

const nk = (s: string) => String(s || '').replace(/‌/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک')
function field(data: Record<string, any>, syns: string[]): { ok: boolean; len: number } {
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue
    const val = String(v).trim(); if (!val) continue
    if (syns.some(s => nk(k).includes(nk(s)))) return { ok: true, len: val.length }
  }
  return { ok: false, len: 0 }
}

// امتیازدهِ محلیِ «اول ماشین‌لرنینگ»: کاملی/کیفیتِ آگهی را قاعده‌محور و آنی می‌سنجد (بدونِ AI).
// چون این endpoint حینِ تایپِ فرم مدام صدا زده می‌شود، پاسخِ آنی هم سریع‌تر است هم رایگان.
function localScore(kind: 'listing' | 'project', data: Record<string, any>): ScoreResult | null {
  const filled = Object.values(data).filter(v => v != null && String(v).trim() !== '').length
  if (!filled) return null
  const title = field(data, ['عنوان'])
  const price = field(data, ['قیمت', 'ودیعه', 'رهن', 'اجاره', 'مبلغ'])
  const area = field(data, ['متراژ', 'مساحت', 'زیربنا', 'متر'])
  const loc = field(data, ['محله', 'منطقه', 'ادرس', 'موقعیت', 'لوکیشن'])
  const desc = field(data, ['توضیح', 'شرح'])
  const rooms = field(data, ['اتاق', 'خواب'])
  const img = field(data, ['عکس', 'تصویر', 'تصاویر', 'فوتو'])
  let score = 0
  const strengths: string[] = [], missing: string[] = [], suggestions: string[] = []
  if (title.ok && title.len >= 8) { score += 15; strengths.push('عنوانِ مناسب دارد') } else { missing.push('عنوانِ گویا'); suggestions.push('یک عنوانِ کامل و جذاب بنویس') }
  if (price.ok) { score += 20; strengths.push('قیمت مشخص است') } else { missing.push('قیمت'); suggestions.push('قیمت (یا ودیعه/اجاره) را وارد کن') }
  if (area.ok) { score += 15; strengths.push('متراژ دارد') } else { missing.push('متراژ'); suggestions.push('متراژ را اضافه کن') }
  if (loc.ok) { score += 15; strengths.push('موقعیت/محله دارد') } else { missing.push('محله/موقعیت'); suggestions.push('محله یا موقعیتِ دقیق را بگذار') }
  if (desc.ok && desc.len >= 40) { score += 20; strengths.push('توضیحاتِ کامل') } else if (desc.ok) { score += 10; suggestions.push('توضیحات را کامل‌تر و جذاب‌تر کن') } else { missing.push('توضیحات'); suggestions.push('توضیحاتِ کامل بنویس') }
  if (rooms.ok) score += 5; else if (kind === 'listing') suggestions.push('تعدادِ اتاق را مشخص کن')
  if (img.ok) { score += 10; strengths.push('عکس دارد') } else suggestions.push('حداقل یک عکسِ باکیفیت اضافه کن')
  score = Math.max(0, Math.min(100, score))
  const level = score < 40 ? 'ضعیف' : score < 60 ? 'متوسط' : score < 80 ? 'خوب' : 'عالی'
  if (!suggestions.length) suggestions.push('عکس‌های بیشتر و توضیحاتِ دقیق‌تر جذبِ خریدار را بالا می‌برد')
  return { score, level, strengths: strengths.slice(0, 3), suggestions: suggestions.slice(0, 4), missing: missing.slice(0, 5) }
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const kind = b.kind === 'project' ? 'project' : 'listing'
  const data = b.data || {}
  const lines = Object.entries(data).filter(([, v]) => v != null && String(v).trim() !== '').map(([k, v]) => `${k}: ${String(v).slice(0, 200)}`).join('\n')
  if (!lines.trim()) return NextResponse.json({ ok: true, result: null })

  const subject = kind === 'project' ? 'پروژهٔ ساختمانی (پیش‌فروش/فروش)' : 'آگهیِ ملک'
  const model = agentModel('pricing', 'text') || agentModel('moderation', 'text') || agentModel('summary', 'text') || fallbackModel()
  const provider = agentProvider('pricing', 'text') || agentProvider('moderation', 'text')
  const sys = `تو یک کارشناسِ خبرهٔ ${subject} هستی که کیفیت و کاملی‌بودنِ یک ${subject} را همان لحظه که کاربر می‌سازد بررسی می‌کنی و راهنمایی می‌دهی تا بهترین حالت ثبت شود. کوتاه، عملی و فارسی. خروجی فقط JSON.`
  const user = `اطلاعاتِ واردشده تا این لحظه:\n${lines}\n\nیک JSON بده:
{
  "score": عددِ ۰ تا ۱۰۰ (کیفیت و کاملی‌بودنِ این ${subject} برای جذبِ خریدار),
  "level": "ضعیف" یا "متوسط" یا "خوب" یا "عالی",
  "strengths": ["۱ تا ۳ نکتهٔ خوبِ فعلی، کوتاه"],
  "suggestions": ["۲ تا ۴ پیشنهادِ مشخص و عملی برای بهترشدن — مثلاً چه چیزی اضافه/اصلاح شود"],
  "missing": ["فیلدها یا اطلاعاتِ مهمی که هنوز خالی‌اند و باید پر شوند"]
}
فقط JSON خروجی بده.`

  // دروازهٔ سه‌پله: کش دقیق → امتیازدهِ محلی (قاعده‌محور، آنی) → AI فقط اگر محلی نتوانست.
  const { value: result } = await mlFirst<ScoreResult | null>({
    task: 'score',
    key: kind + '|' + lines,
    predict: () => { const r = localScore(kind, data); return r ? { value: r, confident: true } : null },
    validate: r => !!r && typeof r.score === 'number',
    ai: async () => {
      try {
        const raw = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.4, max_tokens: 600 }, provider)
        const p = JSON.parse(stripFence(raw))
        const arr = (x: any) => Array.isArray(x) ? x.filter((s: any) => typeof s === 'string').map((s: string) => s.slice(0, 120)).slice(0, 5) : []
        return {
          score: Math.max(0, Math.min(100, Math.round(Number(p.score) || 0))),
          level: String(p.level || '—').slice(0, 12),
          strengths: arr(p.strengths), suggestions: arr(p.suggestions), missing: arr(p.missing),
        }
      } catch { return null }
    },
  })
  return NextResponse.json({ ok: true, result })
}
