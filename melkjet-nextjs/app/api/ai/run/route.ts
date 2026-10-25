import { NextRequest, NextResponse } from 'next/server'
import { requireAndBumpUsage } from '@/app/lib/plan-usage'
import { aiFor, agentModel } from '@/app/lib/gapgpt'
const { chatCompleteUsage, generateImage } = aiFor('ابزارهای AI کاربران')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI
import { getSession } from '@/app/lib/session'
import { canUseToken, recordOp } from '@/app/lib/comm-store'

// System prompts per agent — defines what each agent does
const SYSTEMS: Record<string, string> = {
  chat: 'تو دستیار هوشمند ملک‌جت هستی، یک پلتفرم املاک ایرانی. به فارسی، کوتاه، دقیق و دوستانه پاسخ بده. در خرید، فروش، اجاره، تحلیل قیمت، انتخاب محله و سرمایه‌گذاری ملکی کمک کن. ' +
    'بسیار مهم — هرگز اطلاعاتِ جغرافیایی یا قیمتیِ قطعی را از خودت نساز: شمارهٔ منطقهٔ شهرداریِ تهران، اینکه کدام محله در کدام منطقه است، یا قیمتِ دقیقِ هر محله را حدس نزن و فهرست نکن (مثلاً نگو «منطقه ۱۷ شامل شهرک غرب است») چون اغلب اشتباه است. اگر از یک واقعیتِ مشخص مطمئن نیستی، یا نگو، یا بگو مطمئن نیستی و یک سؤالِ روشن‌کننده بپرس. به‌جای ردیف‌کردنِ محله‌ها و مناطق، دربارهٔ بودجه، نیاز و اولویتِ کاربر بپرس و راهنماییِ کلیِ درست بده؛ برای عدد و محلهٔ دقیق، کاربر را به جستجو و داده‌های خودِ ملک‌جت ارجاع بده.',
  content: 'تو نویسندهٔ محتوای حرفه‌ای املاک هستی. مقالهٔ سئو-محور، روان و فارسی بنویس با تیتر و پاراگراف‌بندی مناسب.',
  moderation: 'تو ناظر آگهی‌های املاک هستی. آگهی داده‌شده را بررسی کن و یک امتیاز ۰ تا ۱۰۰ برای اعتبار/کیفیت بده و دلیل کوتاه بگو. خروجی فارسی و مختصر.',
  pricing: 'تو کارشناس قیمت‌گذاری ملک هستی. بر اساس اطلاعات داده‌شده برآورد قیمت منصفانه و بازهٔ منطقی بده و دلیل بیاور. فارسی و مختصر.',
  summary: 'تو خلاصه‌سازی هستی. متن داده‌شده را به فارسی خلاصه و نکات کلیدی را فهرست کن.',
  translation: 'تو مترجم هستی. متن را به زبان درخواستی (پیش‌فرض فارسی) ترجمه کن.',
  negotiation: 'تو مشاور مذاکرهٔ ملکی هستی. راهکار و جملات مذاکره پیشنهاد بده. فارسی و عملی.',
}

// تاریخچهٔ گفتگو را امن می‌کند: فقط نقش‌های user/assistant، محدودِ طول، سقفِ ۱۰ پیامِ آخر.
// بدونِ این، هر فراخوان تک‌نوبتی بود و مدل همیشه «از خطِ اول» شروع می‌کرد (دستیارِ عمومی).
function sanitizeHistory(h: unknown): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(h)) return []
  return h
    .map((m: any) => {
      const role = m?.role === 'assistant' ? 'assistant' : m?.role === 'user' ? 'user' : null
      const content = (m?.content ?? m?.text ?? '').toString().trim().slice(0, 4000)
      return role && content ? { role, content } : null
    })
    .filter((m): m is { role: 'user' | 'assistant'; content: string } => !!m)
    .slice(-10)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const agent: string = body.agent || 'chat'
  const input: string = (body.input || '').toString().slice(0, 8000)
  const history = sanitizeHistory(body.history)
  const wantImage: boolean = !!body.image
  if (!input.trim()) return NextResponse.json({ error: 'ورودی خالی است' }, { status: 400 })

  const textModel = agentModel(agent, 'text')
  if (!textModel) return NextResponse.json({ error: `مدلی به ایجنت «${agent}» تخصیص داده نشده — از پنل API و مدل‌های AI انتخاب کن` }, { status: 400 })

  // محدودیتِ توکن: اگر بستهٔ توکن فعال باشد و اعتبارِ کاربر صفر باشد، اجازه نده
  const sess = await getSession()
  if (sess && !(await canUseToken(sess.phone, sess.role))) {
    return NextResponse.json({ error: 'اعتبارِ توکنِ هوش مصنوعی شما تمام شده — از بخش «پلن‌ها و اشتراک» توکن تهیه کنید.' }, { status: 402 })
  }
  if (sess) { const u52 = await requireAndBumpUsage(sess as any, 'aiRequests', 1); if (u52) return NextResponse.json(u52, { status: 403 }) }   // فاز ۵۲: سهمیهٔ ماهانهٔ پلن

  try {
    const system = SYSTEMS[agent] || SYSTEMS.chat
    // تاریخچه (اگر فرستاده شده) بینِ system و پیامِ تازه می‌آید تا گفتگو ادامه‌دار بماند.
    const { text, tokens } = await chatCompleteUsage(textModel, [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: input },
    ])
    // هر فراخوانیِ AI = یک «عملیات» (کسرِ ثابت و قابل‌فهم برای کاربر). tokens صرفاً برای لاگ.
    void tokens
    if (sess) await recordOp(sess.phone, sess.role, 1)

    let imageUrl: string | undefined
    if (wantImage) {
      const imgModel = agentModel(agent, 'image')
      if (imgModel) {
        try { imageUrl = await generateImage(imgModel, input) } catch { /* image optional */ }
      }
    }
    return NextResponse.json({ ok: true, text, imageUrl, model: textModel })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در اجرای ایجنت' }, { status: 500 })
  }
}
