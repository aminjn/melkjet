import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { aiFor, agentModel, agentProvider } from '@/app/lib/gapgpt'
const { chatCompleteSafe } = aiFor('AI میزِ حرفه‌ای‌ها')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

// ابزارهای AI تخصصیِ هر شغل (طبقِ سندِ نقش‌ها). هر ابزار یک system-prompt دارد؛
// ورودیِ کاربر (متنِ قرارداد/مشخصاتِ ملک/…) به GapGPT داده و نتیجهٔ ساخت‌یافته برمی‌گردد.
const TOOLS: Record<string, { label: string; system: string }> = {
  // دفترِ حقوقی
  contract_review: { label: 'تحلیلِ قرارداد', system: 'تو وکیل و کارشناسِ حقوقیِ املاک هستی. متنِ قرارداد را بخوان و به‌صورتِ فهرست‌وار بده: ۱) ریسک‌ها و بندهای مبهم/خطرناک ۲) بندهای جاافتاده ۳) پیشنهادِ اصلاح. کوتاه، فارسی و عملی.' },
  legal_risk: { label: 'تشخیصِ ریسکِ حقوقی', system: 'تو مشاورِ حقوقیِ املاک هستی. شرحِ معامله/موقعیت را بخوان و ریسک‌های حقوقیِ احتمالی + راهِ پیشگیری را کوتاه و فهرست‌وار بگو.' },
  // بانک و بیمه
  loan_risk: { label: 'تحلیلِ ریسکِ وام', system: 'تو کارشناسِ اعتباریِ بانک هستی. اطلاعاتِ متقاضی (درآمد، شغل، سابقه، مبلغِ وام) را بخوان و ریسکِ اعطای وام (کم/متوسط/زیاد) + دلیل + پیشنهاد را کوتاه بگو.' },
  loan_advice: { label: 'پیشنهادِ بهترین وام/بیمه', system: 'تو مشاورِ مالیِ املاک هستی. نیازِ مشتری را بخوان و مناسب‌ترین محصولِ وام/بیمه + شرایط + نکاتِ مهم را کوتاه پیشنهاد بده.' },
  // کارشناسِ رسمی
  price_estimate: { label: 'برآوردِ قیمتِ ملک', system: 'تو کارشناسِ رسمیِ ارزیابیِ املاک هستی. مشخصاتِ ملک (منطقه، متراژ، سن، طبقه، امکانات) را بخوان و بازهٔ قیمتِ منصفانه + عواملِ مؤثر + مقایسه با مشابه‌ها را کوتاه بگو.' },
  // معمار
  design_idea: { label: 'پیشنهادِ طراحی', system: 'تو معمار هستی. شرحِ پروژه/فضا را بخوان و ایده‌های طراحیِ کاربردی (پلان، نور، متریال، سبک) + تخمینِ نسبیِ هزینه را کوتاه بده.' },
  cost_estimate: { label: 'تخمینِ هزینهٔ ساخت', system: 'تو کارشناسِ برآوردِ ساخت هستی. مشخصاتِ پروژه (متراژ، تعداد طبقات، کیفیت) را بخوان و تخمینِ نسبیِ هزینهٔ ساخت + سرفصل‌های اصلی را کوتاه بگو (تأکید کن که تخمینی است).' },
  // دفترخانه
  doc_check: { label: 'بررسیِ سند/تشخیصِ خطا', system: 'تو کارشناسِ ثبتِ اسناد هستی. متن/مشخصاتِ سند یا معامله را بخوان و مغایرت‌ها، خطاهای احتمالی و نشانه‌های ریسکِ جعل + مدارکِ لازم برای تأیید را کوتاه و فهرست‌وار بگو.' },
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای استفاده وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const tool = TOOLS[String(b.tool || '')]
  const input = String(b.input || '').trim()
  if (!tool) return NextResponse.json({ error: 'ابزارِ نامعتبر' }, { status: 400 })
  if (!input) return NextResponse.json({ error: 'ورودی خالی است' }, { status: 400 })
  const model = agentModel('chat', 'text') || agentModel('content', 'text')
  if (!model) return NextResponse.json({ error: 'مدلِ هوش مصنوعی در ادمین تنظیم نشده است.' }, { status: 400 })
  try {
    const text = (await chatCompleteSafe(model, [
      { role: 'system', content: tool.system + ' پاسخ را حتماً فارسی و ساخت‌یافته بده.' },
      { role: 'user', content: input.slice(0, 6000) },
    ], { temperature: 0.4, max_tokens: 700 }, agentProvider('chat', 'text'))).trim()
    return NextResponse.json({ ok: true, text: text || 'پاسخی دریافت نشد.' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در پردازش' }, { status: 500 })
  }
}
