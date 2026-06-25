import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listForOwner, addSearch, removeBySig, removeById, sigOf } from '@/app/lib/saved-search-store'

// «آگهی جدید اومد خبرم کن» — جستجوهای ذخیره‌شدهٔ کاربر.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ searches: [] })
  return NextResponse.json({ searches: listForOwner(s.phone) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای فعال‌کردنِ هشدار وارد شوید', needLogin: true }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const deal = (b.deal === 'rent' || b.deal === 'presale') ? b.deal : 'sale'
  const c = { city: b.city ? String(b.city) : undefined, area: b.area ? String(b.area) : undefined, deal: deal as 'sale' | 'rent' | 'presale', kind: b.kind ? String(b.kind) : undefined, priceMax: b.priceMax ? Number(b.priceMax) : undefined, label: b.label ? String(b.label) : undefined }
  if (b.action === 'remove') { removeBySig(s.phone, sigOf(c)); return NextResponse.json({ ok: true, on: false }) }
  if (b.action === 'removeId') { if (b.id) removeById(s.phone, String(b.id)); return NextResponse.json({ ok: true }) }
  const saved = addSearch(s.phone, c)
  return NextResponse.json({ ok: true, on: true, search: saved })
}
