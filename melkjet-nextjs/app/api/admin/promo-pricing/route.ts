import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { PROMO_TIERS, PROMO_CREDIT_PACKS, PROMO_BUNDLES, PROMO_SLOTS, PROMO_ROLE_OPTIONS, slotOf } from '@/app/lib/promotion-store'
import { auctionConfig } from '@/app/lib/auction-store'
import { getPromoPricing, setPromoPricing } from '@/app/lib/promo-pricing-store'
import { logAudit } from '@/app/lib/audit-store'

async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) }

// GET → کاتالوگِ پیش‌فرضِ همهٔ قیمت‌ها + overrideهایِ فعلیِ ادمین (برای پُرکردنِ فرم).
export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({
    defaults: {
      tiers: PROMO_TIERS.map(t => ({ id: t.id, name: t.name, kind: t.kind, target: t.target, price: t.price, days: t.days, forRoles: t.forRoles, where: slotOf(t.slot)?.where || '' })),
      packs: PROMO_CREDIT_PACKS.map(p => ({ id: p.id, name: p.name, pay: p.pay, credit: p.credit })),
      bundles: PROMO_BUNDLES.map(b => ({ id: b.id, name: b.name, price: b.price, tierIds: b.tierIds })),
      auction: [(() => { const a = auctionConfig(); return { id: a.id, label: a.label, minBid: a.minBid, step: a.step, periodDays: a.periodDays, enabled: a.enabled } })()],
    },
    slots: PROMO_SLOTS.map(s => ({ id: s.id, label: s.label, where: s.where, target: s.target })),
    roleOptions: PROMO_ROLE_OPTIONS,
    overrides: await getPromoPricing(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST → ذخیرهٔ overrideها. فقط فیلدهایی که با پیش‌فرض فرق دارند لازم است؛ بقیه حذف می‌شوند.
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const saved = await setPromoPricing(b || {})
  try { const s = await getSession(); logAudit((s as any)?.name || (s as any)?.phone || 'مدیر', 'قیمت‌گذاری پروموت', 'به‌روزرسانی قیمت‌ها') } catch {}
  return NextResponse.json({ ok: true, overrides: saved })
}
