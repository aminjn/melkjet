import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { createCampaign, listCampaigns, getCampaign, setStatus, recordClick, recordImpression, analytics, type PromoModel, type PromoType } from '@/app/lib/reos/promotion-engine'

// GET /api/reos/promo — کمپین‌های کاربر + آنالیتیکس.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const camps = await listCampaigns(s.phone)
  return NextResponse.json({ ok: true, campaigns: camps.map(c => ({ ...c, analytics: analytics(c) })) }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/promo — {action: create|pause|resume|click|impression, ...}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = String(b.action || '')

  if (action === 'create') {
    const c = await createCampaign({
      ownerId: s.phone, targetType: (b.targetType === 'agent' ? 'agent' : 'property'), targetId: String(b.targetId || ''),
      type: (String(b.type || 'boost') as PromoType), model: (String(b.model || 'cpc') as PromoModel),
      budget: Number(b.budget) || 0, bid: Number(b.bid) || 0,
      startAt: b.startAt ? Number(b.startAt) : undefined, endAt: b.endAt ? Number(b.endAt) : undefined,
    })
    return NextResponse.json({ ok: true, campaign: c })
  }
  // اکشن‌هایی که به کمپینِ متعلق به کاربر نیاز دارند
  const id = String(b.id || '')
  const camp = await getCampaign(id)
  if (!camp) return NextResponse.json({ error: 'کمپین یافت نشد' }, { status: 404 })
  // click/impression عمومی‌اند (از رندرِ کارت)؛ pause/resume فقط مالک.
  if (action === 'click') return NextResponse.json({ ok: true, campaign: await recordClick(id) })
  if (action === 'impression') return NextResponse.json({ ok: true, campaign: await recordImpression(id) })
  if (camp.ownerId !== s.phone && s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی نیست' }, { status: 403 })
  if (action === 'pause') { await setStatus(id, 'paused'); return NextResponse.json({ ok: true }) }
  if (action === 'resume') { await setStatus(id, 'active'); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'اکشن نامعتبر' }, { status: 400 })
}
