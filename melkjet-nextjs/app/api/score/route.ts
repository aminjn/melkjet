import { NextRequest, NextResponse } from 'next/server'
import { chatCompleteSafe, agentModel, agentProvider } from '@/app/lib/gapgpt'

export const dynamic = 'force-dynamic'

// امتیازدهی و تحلیلِ زندهٔ آگهی/پروژه هنگامِ ثبت — تا کاربر بهترین آگهی/پروژه را بسازد.
export interface ScoreResult {
  score: number; level: string
  strengths: string[]; suggestions: string[]; missing: string[]
}
function stripFence(s: string): string { const m = s.match(/\{[\s\S]*\}/); return m ? m[0] : s }

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const kind = b.kind === 'project' ? 'project' : 'listing'
  const data = b.data || {}
  const lines = Object.entries(data).filter(([, v]) => v != null && String(v).trim() !== '').map(([k, v]) => `${k}: ${String(v).slice(0, 200)}`).join('\n')
  if (!lines.trim()) return NextResponse.json({ ok: true, result: null })

  const subject = kind === 'project' ? 'پروژهٔ ساختمانی (پیش‌فروش/فروش)' : 'آگهیِ ملک'
  const model = agentModel('pricing', 'text') || agentModel('moderation', 'text') || agentModel('summary', 'text') || 'gpt-4o-mini'
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
  try {
    const raw = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.4, max_tokens: 600 }, provider)
    const p = JSON.parse(stripFence(raw))
    const arr = (x: any) => Array.isArray(x) ? x.filter((s: any) => typeof s === 'string').map((s: string) => s.slice(0, 120)).slice(0, 5) : []
    const result: ScoreResult = {
      score: Math.max(0, Math.min(100, Math.round(Number(p.score) || 0))),
      level: String(p.level || '—').slice(0, 12),
      strengths: arr(p.strengths), suggestions: arr(p.suggestions), missing: arr(p.missing),
    }
    return NextResponse.json({ ok: true, result })
  } catch { return NextResponse.json({ ok: true, result: null }) }
}
