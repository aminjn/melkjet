import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { chatComplete } from '@/app/lib/gapgpt'

// Real chat test against GapGPT so the admin can verify connectivity + model.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const { model } = await req.json().catch(() => ({}))
  const m = (model && String(model)) || 'gpt-4o-mini'
  try {
    const text = await chatComplete(m, [{ role: 'user', content: 'به فارسی فقط بنویس: تست موفق بود.' }], { max_tokens: 30 })
    return NextResponse.json({ ok: true, model: m, text })
  } catch (e: any) {
    return NextResponse.json({ ok: false, model: m, error: e?.message || 'خطا' }, { status: 200 })
  }
}
