import { NextRequest, NextResponse } from 'next/server'
import { normalizeForCompare, type CompareItem } from '@/app/lib/compare-normalize'
import { aiFor, agentModel, agentProvider } from '@/app/lib/gapgpt'
const { chatCompleteSafe } = aiFor('مقایسهٔ ملک')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

export const dynamic = 'force-dynamic'

export interface CompareAnalysis {
  bestIndex: number
  summary: string
  perItem: { score: number; valuation: string; access: string }[]
}

function stripFence(s: string): string { const m = s.match(/\{[\s\S]*\}/); return m ? m[0] : s }

async function analyze(items: CompareItem[]): Promise<CompareAnalysis | null> {
  const model = agentModel('pricing', 'text') || agentModel('summary', 'text') || 'gpt-4o-mini'
  const provider = agentProvider('pricing', 'text') || agentProvider('summary', 'text')
  const desc = items.map((it, i) => `گزینهٔ ${i + 1} — ${it.title}\n${it.specs.map(s => `${s.label}: ${s.value}`).join('، ')}`).join('\n\n')
  const sys = 'تو یک مشاورِ خبرهٔ سرمایه‌گذاریِ املاک در ایران هستی. چند گزینه را مقایسه می‌کنی و بهترین را با دلیل پیشنهاد می‌دهی. خروجی فقط JSON.'
  const user = `این گزینه‌ها را مقایسه کن:\n\n${desc}\n\nیک JSON بده:
{
  "bestIndex": شمارهٔ گزینهٔ پیشنهادی از ۰ شروع,
  "summary": "۲ تا ۳ جمله دربارهٔ اینکه چرا این گزینه بهتر است و تفاوت‌ها",
  "perItem": [ برای هر گزینه به همان ترتیب: {"score": امتیازِ ۰ تا ۱۰۰, "valuation": "مناسب" یا "منصفانه" یا "کمی گران" یا "گران", "access": "عالی" یا "خوب" یا "متوسط" یا "ضعیف"} ]
}
فقط JSON خروجی بده.`
  try {
    const raw = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.4, max_tokens: 700 }, provider)
    const p = JSON.parse(stripFence(raw))
    const perItem = Array.isArray(p.perItem) ? p.perItem.map((x: any) => ({ score: Math.max(0, Math.min(100, Math.round(Number(x.score) || 0))), valuation: String(x.valuation || '—').slice(0, 16), access: String(x.access || '—').slice(0, 16) })) : []
    while (perItem.length < items.length) perItem.push({ score: 0, valuation: '—', access: '—' })
    return { bestIndex: Math.max(0, Math.min(items.length - 1, Number(p.bestIndex) || 0)), summary: String(p.summary || '').slice(0, 500), perItem }
  } catch { return null }
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const reqItems: { kind: string; id: string }[] = Array.isArray(b.items) ? b.items.slice(0, 4) : []
  const items = (await Promise.all(reqItems.map(r => normalizeForCompare(r.kind, r.id)))).filter(Boolean) as CompareItem[]
  if (!items.length) return NextResponse.json({ ok: false, error: 'موردی برای مقایسه نیست' }, { status: 400 })
  const analysis = b.ai === false ? null : await analyze(items)
  return NextResponse.json({ ok: true, items, analysis })
}
