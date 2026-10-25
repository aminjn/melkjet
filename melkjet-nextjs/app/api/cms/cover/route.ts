import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { aiFor, agentModel } from '@/app/lib/gapgpt'
import { mlFirst } from '@/app/lib/ml-gateway'
import { imageConfigured } from '@/app/lib/self-host'
const { generateImage } = aiFor('کاورِ مقاله (CMS)')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

// تولید تصویر شاخص مقاله با هوش مصنوعی.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const title = String(b.title || '').trim()
  if (!title) return NextResponse.json({ error: 'عنوان لازم است' }, { status: 400 })
  // فاز ۳۲۸ — سرورِ تصویرِ خودیِ مالک (qwen_image) اگر روشن باشد مدلِ تخصیصی لازم نیست؛
  // generateImage خودش وقتی self-host تنظیم است مدل را نادیده می‌گیرد و از آن استفاده می‌کند.
  const selfHost = imageConfigured()
  const model = agentModel('content', 'image') || agentModel('studio', 'image') || (selfHost ? 'self-host' : '')
  if (!model) return NextResponse.json({ error: 'مدلِ تصویر تنظیم نیست — یا در «سرویس‌های خودی» سرورِ تصویر را روشن کن، یا به ایجنت ContentAgent یک مدل تصویر بده (پنل → API و مدل‌های AI).' }, { status: 400 })
  // فاز ۳۳۰ — عنوانِ فارسی را «داخلِ» پرامپت نمی‌گذاریم: مدلِ تصویر (Qwen-Image که در نوشتنِ متن قوی
  // است) سعی می‌کرد همان عنوان را روی عکس بنویسد و چون فارسی/عربی را درست نمی‌نویسد، متنِ دری‌وری
  // تولید می‌شد. حالا فقط یک صحنهٔ بصریِ مرتبط با املاک، با تأکیدِ شدید بر «بدونِ هیچ متن».
  const prompt = `Professional editorial cover photograph for a real estate article. Modern residential apartment building exterior in a Middle Eastern city, clean contemporary architecture, large glass windows, warm natural daylight, clear blue sky, photorealistic, high detail, magazine quality, cinematic. Absolutely no text, no words, no letters, no numbers, no captions, no signage, no watermark, no logo.`
  try {
    // کش: همان عنوان → همان کاور، بدونِ تولیدِ دوبارهٔ تصویر (گران‌ترین فراخوان).
    // v2: پرامپتِ ضدِ متن عوض شد، پس کلیدِ کش هم نو می‌شود تا کاورهای قدیمیِ دری‌وری سرو نشوند.
    const url = (await mlFirst<string>({
      task: 'cms-cover', key: title + '|' + model + '|v2', validate: v => typeof v === 'string' && v.length > 0,
      // steps بالاتر برای کیفیتِ بهترِ کاور (~۷۰ث به‌جای ۵۱ث)؛ negativeِ ضدِ متن/کیفیت پیش‌فرض است.
      ai: async () => (await generateImage(model, prompt, '1024x1024', undefined, { steps: 28 })) || '',
    })).value
    if (!url) return NextResponse.json({ error: 'تصویری ساخته نشد' }, { status: 200 })
    return NextResponse.json({ ok: true, url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در تولید تصویر' }, { status: 200 })
  }
}
