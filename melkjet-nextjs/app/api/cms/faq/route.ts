import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { chatCompleteSafe, agentModel } from '@/app/lib/gapgpt'

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
    let text = await chatCompleteSafe(model, [
      { role: 'system', content: SYS },
      { role: 'user', content: `موضوع: ${topic}${context ? `\nخلاصهٔ مقاله: ${context}` : ''}` },
    ], { temperature: 0.7, max_tokens: 1400 })
    const m = text.match(/\{[\s\S]*\}/); if (m) text = m[0]
    const d = JSON.parse(text)
    const faqs = Array.isArray(d.faqs) ? d.faqs.filter((x: any) => x.q && x.a).slice(0, 8) : []
    return NextResponse.json({ ok: true, faqs })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در تولید' }, { status: 200 })
  }
}
