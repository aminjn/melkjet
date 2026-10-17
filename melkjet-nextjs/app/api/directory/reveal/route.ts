import { NextRequest, NextResponse } from 'next/server'
import { openPhone } from '@/app/lib/phone-token'
import { recordSiteHit, getSiteStats } from '@/app/lib/site-stats-store'

export const runtime = 'nodejs'

// فاز ۳۰۴د — «نمایشِ شمارهٔ» متخصصِ دایرکتوری (کارشناسِ رسمی / وکیل). شماره در HTML فقط به‌شکلِ
// توکنِ رمزنگاری‌شده است (phone-token)؛ با کلیک سرور بازش می‌کند، و هر نمایش در آمارِ همان متخصص
// (کلیدِ dir:{id}) شمرده می‌شود تا هم در پروفایلِ خودش و هم در سوپرادمین «میزانِ کلیک» دیده شود.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const id = String(b.id || '').slice(0, 120)
  const token = String(b.token || '')
  const phone = openPhone(token)
  if (!phone) return NextResponse.json({ ok: false }, { status: 400 })
  let reveals = 0
  if (id) {
    try { await recordSiteHit('dir:' + id, 'phone'); reveals = (await getSiteStats('dir:' + id))?.totalP || 0 } catch {}
  }
  return NextResponse.json({ ok: true, phone, reveals }, { headers: { 'Cache-Control': 'no-store, private' } })
}
