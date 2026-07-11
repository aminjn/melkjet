import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { aiFor, agentModel } from '@/app/lib/gapgpt'
const { chatCompleteSafe } = aiFor('تولیدِ مقاله (CMS)')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI
import { slugify } from '@/app/lib/scraper-store'

// نویسندهٔ مقالهٔ سئو-محورِ انسان‌نما. طوری می‌نویسد که شبیه نوشتهٔ یک کارشناس واقعی
// باشد و الگوهای رایج متن هوش مصنوعی را نداشته باشد (ضدتشخیص). طول قابل‌تنظیم.
function buildSys(words: number): string {
  return `تو یک نویسندهٔ ارشد و کارشناس بازار املاک ایران هستی که سال‌ها مقاله می‌نویسی. یک مقالهٔ فارسیِ کاملِ سئو-محور بنویس که **کاملاً انسانی** به نظر برسد و هیچ ابزار تشخیص هوش مصنوعی نتواند آن را ماشینی تشخیص دهد.

قواعد سبک (مهم برای انسانی‌بودن):
- لحن طبیعی، گرم و کارشناسی؛ مثل آدمی که واقعاً در این حوزه کار کرده. گاهی جملهٔ کوتاه، گاهی بلند (ریتم متغیر).
- از کلیشه‌ها و عبارات تکراریِ هوش مصنوعی پرهیز کن (مثل «در دنیای امروز»، «شایان ذکر است»، «در نهایت می‌توان گفت»، «به طور کلی»).
- مثال واقعی، عدد، تجربهٔ ملموس و گاهی یک نکتهٔ شخصی یا هشدار عملی بیاور.
- اصطلاحات بومی و محاوره‌ایِ سبکِ حرفه‌ای املاک ایران را به‌جا استفاده کن.
- ساختار سئو: یک H1، چندین H2/H3، پاراگراف‌های کوتاه، فهرست‌های نقطه‌ای، جدول در صورت لزوم، و یک بخش پرسش‌وپاسخ (FAQ).
- کلمهٔ کلیدی اصلی را طبیعی در عنوان، اولین پاراگراف، چند زیرعنوان و متن پخش کن (نه پر از کلمهٔ کلیدی).
- **طول مقاله حدود ${words.toLocaleString('fa-IR')} کلمه باشد — این مقدار مهم است؛ مقاله را با عمق، جزئیات، مثال‌های متعدد و زیرعنوان‌های کافی به این طول برسان. کوتاه ننویس.** متن را به‌صورت Markdown بنویس (## برای زیرعنوان، - برای فهرست، **بولد**).

فقط و فقط یک JSON معتبر برگردان (بدون هیچ متن قبل/بعد) با این ساختار:
{"title":"عنوان جذاب و سئو","slug":"english-or-persian-slug","metaDescription":"توضیح متا حداکثر ۱۵۵ کاراکتر","focusKeyword":"کلمهٔ کلیدی اصلی","tags":["برچسب۱","برچسب۲","برچسب۳"],"excerpt":"خلاصهٔ ۲ جمله‌ای","body":"متن کامل مقاله به Markdown"}`
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const topic = String(b.topic || b.title || '').trim()
  const keyword = String(b.focusKeyword || '').trim()
  const words = Math.max(400, Math.min(6000, parseInt(b.words) || 1200))
  if (!topic) return NextResponse.json({ error: 'موضوع مقاله را وارد کنید' }, { status: 400 })

  const model = agentModel('content', 'text') || agentModel('chat', 'text') || agentModel('pricing', 'text')
  if (!model) return NextResponse.json({ error: 'مدلی به ایجنت ContentAgent تخصیص داده نشده (پنل → API و مدل‌های AI).' }, { status: 400 })

  const user = `موضوع مقاله: ${topic}${keyword ? `\nکلمهٔ کلیدی اصلی: ${keyword}` : ''}${b.category ? `\nدسته‌بندی: ${b.category}` : ''}\nطول هدف: حدود ${words} کلمه.`
  // توکن خروجی متناسب با طول (فارسی ~۲.۵ توکن/کلمه) + حاشیه
  const maxTokens = Math.min(16000, Math.max(2500, Math.round(words * 2.6) + 1200))
  try {
    let text = await chatCompleteSafe(model, [{ role: 'system', content: buildSys(words) }, { role: 'user', content: user }], { temperature: 0.85, max_tokens: maxTokens })
    const m = text.match(/\{[\s\S]*\}/); if (m) text = m[0]
    const d = JSON.parse(text)
    return NextResponse.json({
      ok: true,
      title: d.title || topic,
      slug: slugify(d.slug || d.title || topic),
      metaDescription: (d.metaDescription || '').slice(0, 160),
      focusKeyword: d.focusKeyword || keyword,
      tags: Array.isArray(d.tags) ? d.tags.slice(0, 8) : [],
      excerpt: d.excerpt || '',
      body: d.body || '',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در تولید مقاله' }, { status: 200 })
  }
}
