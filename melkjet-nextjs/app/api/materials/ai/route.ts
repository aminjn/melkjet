import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { chatCompleteSafe, agentModel, agentProvider } from '@/app/lib/gapgpt'

// دستیارِ هوش مصنوعیِ ساختِ محصولِ مصالح: توضیحات، مشخصاتِ فنی، پیشنهادِ قیمت، برچسب‌ها.
export const dynamic = 'force-dynamic'

function resolveModel(): { model?: string; provider?: string } {
  const model = agentModel('content', 'text') || agentModel('chat', 'text') || agentModel('pricing', 'text')
  const provider = agentProvider('content', 'text') || agentProvider('chat', 'text') || agentProvider('pricing', 'text')
  return { model, provider }
}

function ctxOf(b: any): string {
  const parts = [
    b.name && `نام محصول: ${b.name}`,
    b.category && `دسته: ${b.category}`,
    b.brand && `برند/تولیدکننده: ${b.brand}`,
    b.origin && `کشور/محلِ ساخت: ${b.origin}`,
    b.unit && `واحد فروش: ${b.unit}`,
    Array.isArray(b.specs) && b.specs.length && `مشخصاتِ فعلی: ${b.specs.map((s: any) => `${s.key}: ${s.value}`).join('، ')}`,
  ].filter(Boolean)
  return parts.join('\n')
}

// استخراجِ JSON از پاسخِ مدل (گاهی داخلِ ```json ... ``` می‌آید).
function parseJson(text: string): any {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  const raw = m ? m[1] || m[0] : text
  try { return JSON.parse(raw.trim()) } catch { return null }
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای استفاده از دستیار وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const action = String(b.action || '')
  if (!b.name || !String(b.name).trim()) return NextResponse.json({ error: 'ابتدا نامِ محصول را وارد کنید' }, { status: 400 })

  const { model, provider } = resolveModel()
  if (!model) return NextResponse.json({ error: 'مدلی به دستیارِ محتوا تخصیص داده نشده (پنل مدیریت → API و مدل‌های AI).' }, { status: 400 })
  const ctx = ctxOf(b)

  try {
    if (action === 'describe') {
      const sys = 'تو کارشناسِ فروشِ مصالحِ ساختمانی هستی. برای این محصول یک توضیحِ فروشگاهیِ فارسیِ حرفه‌ای، دقیق و کاربردی بنویس (۳ تا ۵ جمله): کاربرد، مزیت‌ها، نکتهٔ کیفی و مناسب برای چه پروژه‌هایی. لحن طبیعی و فروشنده‌محور، بدونِ اغراقِ توخالی و بدونِ کلیشهٔ هوش مصنوعی. فقط متنِ توضیح را برگردان، بدونِ عنوان یا علامتِ نقل‌قول.'
      const text = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: ctx }], { temperature: 0.8, max_tokens: 500 }, provider)
      return NextResponse.json({ ok: true, description: text.trim() })
    }
    if (action === 'specs') {
      const sys = 'تو کارشناسِ فنیِ مصالحِ ساختمانی هستی. برای این محصول فهرستی از مشخصاتِ فنیِ واقعی و مرتبط بده (مثلِ ابعاد، وزن، استاندارد، درجه، مقاومت، رنگ، بسته‌بندی و…). فقط و فقط یک آرایهٔ JSON معتبر برگردان به شکلِ [{"key":"عنوانِ مشخصه","value":"مقدار"}] با ۴ تا ۸ قلم. بدونِ هیچ متنِ اضافه. اگر مقداری قطعی نیست، مقدارِ رایج/نمونه بده.'
      const text = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: ctx }], { temperature: 0.5, max_tokens: 700 }, provider)
      const arr = parseJson(text)
      if (!Array.isArray(arr)) return NextResponse.json({ error: 'پاسخِ نامعتبر از مدل' }, { status: 502 })
      const specs = arr.map((x: any) => ({ key: String(x.key || x.name || '').slice(0, 60), value: String(x.value || '').slice(0, 120) })).filter((x: any) => x.key && x.value).slice(0, 12)
      return NextResponse.json({ ok: true, specs })
    }
    if (action === 'tags') {
      const sys = 'برای این محصولِ مصالحِ ساختمانی ۵ تا ۸ برچسبِ جستجوپذیرِ فارسیِ کوتاه بده (نامِ عام، کاربرد، مترادف‌ها). فقط یک آرایهٔ JSON از رشته‌ها برگردان، بدونِ متنِ اضافه.'
      const text = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: ctx }], { temperature: 0.6, max_tokens: 300 }, provider)
      const arr = parseJson(text)
      if (!Array.isArray(arr)) return NextResponse.json({ error: 'پاسخِ نامعتبر از مدل' }, { status: 502 })
      const tags = arr.map((x: any) => String(x).slice(0, 40)).filter(Boolean).slice(0, 12)
      return NextResponse.json({ ok: true, tags })
    }
    if (action === 'price') {
      const sys = 'تو کارشناسِ قیمت‌گذاریِ بازارِ مصالحِ ساختمانیِ ایران هستی. برای این محصول یک بازهٔ قیمتِ منطقی به تومان به‌ازای واحدِ فروش پیشنهاد بده (بر اساسِ نرخِ عرفیِ بازارِ ایران). فقط یک JSON معتبر برگردان: {"min":<عدد تومان>,"max":<عدد تومان>,"note":"<توضیحِ کوتاه>"}. اعداد بدونِ جداکننده.'
      const text = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: ctx }], { temperature: 0.4, max_tokens: 300 }, provider)
      const j = parseJson(text)
      if (!j || (!j.min && !j.max)) return NextResponse.json({ error: 'پاسخِ نامعتبر از مدل' }, { status: 502 })
      return NextResponse.json({ ok: true, min: Math.max(0, Number(j.min) || 0), max: Math.max(0, Number(j.max) || 0), note: String(j.note || '').slice(0, 200) })
    }
    return NextResponse.json({ error: 'عملیاتِ نامعتبر' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در ارتباط با هوش مصنوعی' }, { status: 500 })
  }
}
