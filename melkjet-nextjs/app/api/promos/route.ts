import { NextRequest, NextResponse } from 'next/server'
import { redeemPromo } from '@/app/lib/promo-store'

// PUBLIC checkout validation — no auth.
// POST { code } → { ok, discount: { type, value, description } } | { ok:false, error }
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const code = String(b.code || '').trim()
  if (!code) return NextResponse.json({ ok: false, error: 'کد تخفیف را وارد کنید' }, { status: 400 })
  const result = redeemPromo(code)
  if (!result.ok || !result.promo) {
    return NextResponse.json({ ok: false, error: result.error || 'کد تخفیف نامعتبر است' })
  }
  const { type, value, description } = result.promo
  return NextResponse.json({ ok: true, discount: { type, value, description } })
}
