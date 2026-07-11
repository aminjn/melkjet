import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { addPoints } from '@/app/lib/market-data'
import { aiFor, agentModel } from '@/app/lib/gapgpt'
const { chatCompleteSafe } = aiFor('ورودِ دادهٔ بازار (ادمین)')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

// Extract structured market data points from a document's text using AI, then store them.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const text = String(b.text || '').slice(0, 16000)
  const source = String(b.source || 'سند').slice(0, 80)
  if (text.trim().length < 30) return NextResponse.json({ error: 'متن خیلی کوتاه است' }, { status: 400 })

  const model = agentModel('summary', 'text') || agentModel('content', 'text') || agentModel('chat', 'text') || 'gpt-4o-mini'
  const system = `تو یک تحلیلگر دادهٔ املاک هستی. از متن گزارش/سند زیر، نقاط دادهٔ کمی و ساختاریافته دربارهٔ بازار ملک را استخراج کن. فقط یک آرایهٔ JSON معتبر برگردان (بدون متن اضافه) با این ساختار:
[{"city":"تهران","district":"سعادت‌آباد","period":"1403","metric":"میانگین قیمت هر متر","value":120000000,"unit":"تومان","note":""}]
قواعد: اگر شهر یا محله مشخص نیست، آن فیلد را حذف کن. period سال شمسی یا «سال-ماه». metric مثل «میانگین قیمت هر متر»، «تعداد معاملات»، «نرخ رشد سالانه»، «شاخص اجاره». value فقط عدد (بدون جداکننده). فقط داده‌های عددی واقعی موجود در متن را بیاور؛ چیزی از خودت نساز. اگر داده‌ای نبود، [] برگردان.`

  try {
    let out = await chatCompleteSafe(model, [{ role: 'system', content: system }, { role: 'user', content: text }], { temperature: 0.2 })
    const m = out.match(/\[[\s\S]*\]/); if (m) out = m[0]
    const arr = JSON.parse(out)
    if (!Array.isArray(arr)) return NextResponse.json({ error: 'خروجی نامعتبر' }, { status: 200 })
    const points = arr.map((p: any) => ({
      city: p.city ? String(p.city) : undefined,
      district: p.district ? String(p.district) : undefined,
      period: p.period ? String(p.period) : undefined,
      metric: String(p.metric || '').slice(0, 60),
      value: Number(String(p.value).replace(/[^\d.-]/g, '')),
      unit: p.unit ? String(p.unit).slice(0, 20) : undefined,
      note: p.note ? String(p.note).slice(0, 200) : undefined,
      source,
    })).filter((p: any) => p.metric && isFinite(p.value))
    const added = addPoints(points)
    return NextResponse.json({ ok: true, added, points: points.slice(0, 50) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا در استخراج' }, { status: 200 })
  }
}
