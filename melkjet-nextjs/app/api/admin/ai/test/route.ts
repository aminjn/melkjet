import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { chatComplete, generateImage } from '@/app/lib/gapgpt'

// تستِ واقعیِ اتصال به سرویسِ AI (avalai/گپ) — متن یا تصویر — تا ادمین مدل را راستی‌آزمایی کند.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { model, kind } = await req.json().catch(() => ({}))

  if (kind === 'image') {
    const m = (model && String(model)) || 'gpt-image-1'
    try {
      const image = await generateImage(m, 'a clean modern 2D architectural floor plan of a small apartment, top-down blueprint, labeled rooms, white background, technical line drawing', '1024x1024')
      if (!image) return NextResponse.json({ ok: false, model: m, error: 'مدل تصویری برگرداند ولی خروجی خالی بود' }, { status: 200 })
      return NextResponse.json({ ok: true, model: m, image })
    } catch (e: any) {
      return NextResponse.json({ ok: false, model: m, error: e?.message || 'خطا' }, { status: 200 })
    }
  }

  const m = (model && String(model)) || 'gpt-4o-mini'
  try {
    const text = await chatComplete(m, [{ role: 'user', content: 'به فارسی فقط بنویس: تست موفق بود.' }], { max_tokens: 30 })
    return NextResponse.json({ ok: true, model: m, text })
  } catch (e: any) {
    return NextResponse.json({ ok: false, model: m, error: e?.message || 'خطا' }, { status: 200 })
  }
}
