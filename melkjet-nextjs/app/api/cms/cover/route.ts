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
  const prompt = `Professional editorial cover image for a Persian real-estate article titled "${title}". Modern, clean, realistic real-estate / architecture photography style, warm tones, high quality, no text.`
  try {
    // کش: همان عنوان → همان کاور، بدونِ تولیدِ دوبارهٔ تصویر (گران‌ترین فراخوان).
    const url = (await mlFirst<string>({
      task: 'cms-cover', key: title + '|' + model, validate: v => typeof v === 'string' && v.length > 0,
      ai: async () => (await generateImage(model, prompt, '1024x1024')) || '',
    })).value
    if (!url) return NextResponse.json({ error: 'تصویری ساخته نشد' }, { status: 200 })
    return NextResponse.json({ ok: true, url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در تولید تصویر' }, { status: 200 })
  }
}
