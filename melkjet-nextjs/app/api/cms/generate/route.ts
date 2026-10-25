import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { aiFor, agentModel } from '@/app/lib/gapgpt'
const { chatCompleteSafe } = aiFor('تولیدِ مقاله (CMS)')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI
import { slugify } from '@/app/lib/scraper-store'
import { looseJson } from '@/app/lib/ai-json'

// فاز ۳۲۸ — جداکنندهٔ متادیتا از بدنه. ریشهٔ «خطا در ارتباط»: از مدل می‌خواستیم کلِ مقالهٔ
// چندهزارکلمه‌ایِ Markdown را «داخلِ» رشتهٔ JSON (فیلدِ body) بگذارد؛ مدل‌های محلی (qwen) نمی‌توانند
// نقلِ‌قول/خطِ‌جدید/بک‌اسلشِ چنین رشتهٔ بزرگی را درست escape کنند → JSON.parse می‌شکست
// («Expected ',' … at position 3525»). حالا متادیتا یک خطِ کوتاهِ JSON است و بدنه «بیرونِ» JSON،
// پس از این جداکننده — متنِ خام، هیچ escapeای لازم ندارد.
const BODY_SEP = '===متن مقاله==='

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

خروجی را **دقیقاً** در دو بخش و با همین ترتیب بده:

۱) ابتدا یک **خطِ** JSON فشرده (همه در یک خط، بدونِ خطِ جدید و بدونِ حصارِ markdown) فقط با متادیتا — بدونِ متنِ مقاله:
{"title":"عنوان جذاب و سئو","slug":"english-or-persian-slug","metaDescription":"توضیح متا حداکثر ۱۵۵ کاراکتر","focusKeyword":"کلمهٔ کلیدی اصلی","tags":["برچسب۱","برچسب۲","برچسب۳"],"excerpt":"خلاصهٔ ۲ جمله‌ای"}

۲) سپس در خطِ بعد، دقیقاً این جداکننده را تنها در یک خط بگذار:
${BODY_SEP}

۳) و بعد از جداکننده، کلِ متنِ مقاله را به‌صورتِ Markdownِ خام بنویس (هیچ JSON، هیچ نقلِ‌قول دورِ کلِ متن، هیچ حصارِ \`\`\`). فقط خودِ مقاله.`
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
    const text = await chatCompleteSafe(model, [{ role: 'system', content: buildSys(words) }, { role: 'user', content: user }], { temperature: 0.85, max_tokens: maxTokens })
    if (!text || !text.trim()) return NextResponse.json({ error: 'مدل پاسخِ خالی داد — دوباره تلاش کن یا مدلِ دیگری به ایجنت بده' }, { status: 200 })

    // جداسازیِ متادیتا (خطِ JSON) از بدنه (Markdownِ خام پس از جداکننده).
    let meta: any = {}
    let body = ''
    const sepIdx = text.indexOf(BODY_SEP)
    if (sepIdx >= 0) {
      meta = looseJson<any>(text.slice(0, sepIdx)) || {}
      body = text.slice(sepIdx + BODY_SEP.length).trim()
    } else {
      // مدل جداکننده را نگذاشت: اگر JSONِ قدیمی با فیلدِ body داد از آن بخوان؛ وگرنه کلِ متن = بدنه.
      const parsed = looseJson<any>(text)
      if (parsed && (parsed.body || parsed.title)) { meta = parsed; body = String(parsed.body || '').trim() }
      else body = text.trim()
    }
    // حصارِ ```markdown اگر دورِ بدنه مانده بود پاک شود.
    body = body.replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/i, '').trim()
    if (!body) return NextResponse.json({ error: 'متنِ مقاله از پاسخِ مدل استخراج نشد — دوباره تلاش کن' }, { status: 200 })

    return NextResponse.json({
      ok: true,
      title: meta.title || topic,
      slug: slugify(meta.slug || meta.title || topic),
      metaDescription: (meta.metaDescription || '').slice(0, 160),
      focusKeyword: meta.focusKeyword || keyword,
      tags: Array.isArray(meta.tags) ? meta.tags.slice(0, 8) : [],
      excerpt: meta.excerpt || '',
      body,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در تولید مقاله' }, { status: 200 })
  }
}
