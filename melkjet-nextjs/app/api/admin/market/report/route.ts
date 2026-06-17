import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listPoints } from '@/app/lib/market-data'
import { chatCompleteSafe, agentModel } from '@/app/lib/gapgpt'

// Generate a market analysis report from the dataset using AI.
export async function POST() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const pts = listPoints().slice(0, 200)
  if (!pts.length) return NextResponse.json({ error: 'دیتاست خالی است' }, { status: 400 })
  const model = agentModel('summary', 'text') || agentModel('content', 'text') || 'gpt-4o-mini'
  const data = pts.map(p => `${[p.district, p.city].filter(Boolean).join(' ')} ${p.period || ''} | ${p.metric}: ${p.value.toLocaleString('fa-IR')} ${p.unit || ''}`).join('\n')
  try {
    const text = await chatCompleteSafe(model, [
      { role: 'system', content: 'تو تحلیلگر بازار املاک هستی. بر اساس این داده‌ها یک گزارش تحلیلی فارسی بنویس: روند کلی قیمت، گران‌ترین/ارزان‌ترین مناطق، نکات کلیدی و پیش‌بینی. مختصر و کاربردی.' },
      { role: 'user', content: data },
    ], { max_tokens: 900 })
    return NextResponse.json({ ok: true, text })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا' }, { status: 200 })
  }
}
