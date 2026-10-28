import { NextRequest, NextResponse } from 'next/server'
import { requireQuota } from '@/app/lib/plan-gate'
import { getSession } from '@/app/lib/session'
import { listForOwner, addSearch, removeBySig, removeById, sigOf } from '@/app/lib/saved-search-store'
import { canonSpecQs, specLabel } from '@/app/lib/search-query'

// «آگهی جدید اومد خبرم کن» — جستجوهای ذخیره‌شدهٔ کاربر.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ searches: [] })
  return NextResponse.json({ searches: await listForOwner(s.phone) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای فعال‌کردنِ هشدار وارد شوید', needLogin: true }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const deal = (b.deal === 'rent' || b.deal === 'presale') ? b.deal : 'sale'
  let c: { city?: string; area?: string; deal: 'sale' | 'rent' | 'presale'; kind?: string; priceMax?: number; label?: string; qs?: string } = { city: b.city ? String(b.city) : undefined, area: b.area ? String(b.area) : undefined, deal: deal as 'sale' | 'rent' | 'presale', kind: b.kind ? String(b.kind) : undefined, priceMax: b.priceMax ? Number(b.priceMax) : undefined, label: b.label ? String(b.label) : undefined }
  // فاز د — مشخصاتِ کاملِ جستجو (همهٔ فیلترها + محله + محدودهٔ نقشه). فیلدهای قدیمی از همان پر می‌شوند.
  if (typeof b.qs === 'string' && b.qs.trim()) {
    const sp = new URLSearchParams(b.qs)
    const qs = canonSpecQs(sp), cs = new URLSearchParams(qs)
    const d = cs.get('deal')
    c = { qs, label: specLabel(cs), city: cs.get('city') || undefined, area: cs.get('hood') || undefined, deal: d === 'rent' || d === 'presale' ? d : 'sale', kind: cs.get('kind') || undefined, priceMax: Number(cs.get('pmax')) || undefined }
  }
  if (b.action === 'remove') { await removeBySig(s.phone, sigOf(c)); return NextResponse.json({ ok: true, on: false }) }
  if (b.action === 'removeId') { if (b.id) await removeById(s.phone, String(b.id)); return NextResponse.json({ ok: true }) }
  { const q52 = requireQuota(s as any, 'savedSearches', (await listForOwner(s.phone)).length, 1); if (q52) return NextResponse.json(q52, { status: 403 }) }   // فاز ۵۲: سقفِ داینامیکِ پلن
  const saved = await addSearch(s.phone, c)
  return NextResponse.json({ ok: true, on: true, search: saved })
}
