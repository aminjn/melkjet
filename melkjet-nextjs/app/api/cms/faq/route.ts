import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { aiFor, agentModel } from '@/app/lib/gapgpt'
import { mlFirst } from '@/app/lib/ml-gateway'
import { looseJson } from '@/app/lib/ai-json'
const { chatCompleteSafe } = aiFor('پرسش‌وپاسخِ مقاله (CMS)')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

// تولید سؤالات متداول (FAQ) برای یک مقاله — انسان‌نما و سئو، خروجی JSON.
const SYS = `تو کارشناس املاک ایران هستی. برای موضوع داده‌شده ۵ تا ۷ «سؤال متداول» واقعی و پرتکرار کاربران بنویس با پاسخ‌های دقیق، کاربردی و طبیعی (نه ماشینی). فقط یک JSON معتبر برگردان:
{"faqs":[{"q":"سؤال؟","a":"پاسخ کامل و مفید"}]}`

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const topic = String(b.topic || b.title || '').trim()
  const context = String(b.context || '').replace(/<[^>]+>/g, ' ').slice(0, 1500)
  if (!topic) return NextResponse.json({ error: 'موضوع لازم است' }, { status: 400 })
  const model = agentModel('content', 'text') || agentModel('chat', 'text') || agentModel('pricing', 'text')
  if (!model) return NextResponse.json({ error: 'مدلی به ایجنت ContentAgent تخصیص داده نشده' }, { status: 400 })
  try {
    let text = (await mlFirst<string>({
      task: 'cms-faq', key: topic + '|' + context, validate: v => typeof v === 'string' && v.trim().length > 0,
      ai: async () => await chatCompleteSafe(model, [
        { role: 'system', content: SYS },
        { role: 'user', content: `موضوع: ${topic}${context ? `\nخلاصهٔ مقاله: ${context}` : ''}` },
      ], { temperature: 0.7, max_tokens: 1400 }),
    })).value || ''
    if (!text.trim()) return NextResponse.json({ error: 'مدل پاسخِ خالی داد' }, { status: 200 })
    const d = looseJson<any>(text) || {}
    // مدل گاهی مستقیم آرایه می‌دهد؛ گاهی {faqs:[…]}.
    const arr = Array.isArray(d) ? d : Array.isArray(d.faqs) ? d.faqs : []
    const faqs = arr.filter((x: any) => x && x.q && x.a).slice(0, 8)
    if (!faqs.length) return NextResponse.json({ error: 'سؤالی از پاسخِ مدل استخراج نشد' }, { status: 200 })
    return NextResponse.json({ ok: true, faqs })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در تولید' }, { status: 200 })
  }
}
