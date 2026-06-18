import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { generateImage, agentModel } from '@/app/lib/gapgpt'

// تولید تصویر شاخص مقاله با هوش مصنوعی.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const title = String(b.title || '').trim()
  if (!title) return NextResponse.json({ error: 'عنوان لازم است' }, { status: 400 })
  const model = agentModel('content', 'image') || agentModel('studio', 'image')
  if (!model) return NextResponse.json({ error: 'به ایجنت ContentAgent یک مدل تصویر بده (پنل → API و مدل‌های AI).' }, { status: 400 })
  const prompt = `Professional editorial cover image for a Persian real-estate article titled "${title}". Modern, clean, realistic real-estate / architecture photography style, warm tones, high quality, no text.`
  try {
    const url = await generateImage(model, prompt, '1024x1024')
    if (!url) return NextResponse.json({ error: 'تصویری ساخته نشد' }, { status: 200 })
    return NextResponse.json({ ok: true, url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در تولید تصویر' }, { status: 200 })
  }
}
