import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { dedupeListings } from '@/app/lib/listing-dedupe'
import { listItems, deleteItems } from '@/app/lib/scraper-store'
import { logAudit } from '@/app/lib/audit-store'

// پاک‌سازیِ آگهی‌های تکراری (فقط سوپرادمین).
// پیش‌فرض: قدیمی‌ترینِ هر گروه می‌ماند، بقیه «duplicate» (خارج از نمایشِ عمومی) می‌شوند.
// body { purge: true }: همهٔ آیتم‌های علامت‌خوردهٔ «duplicate» برای همیشه حذفِ فیزیکی می‌شوند.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as { purge?: boolean }))
  const actor = (s as { name?: string }).name || s.phone || 'مدیر'

  if (b.purge) {
    const dups = (await listItems('listing')).filter(i => i.status === 'duplicate')
    if (dups.length) await deleteItems(dups.map(d => d.id))
    logAudit(actor, 'حذفِ قطعیِ تکراری‌ها', `${dups.length} آیتم برای همیشه حذف شد`)
    return NextResponse.json({ ok: true, purged: dups.length })
  }

  const r = await dedupeListings()
  logAudit(actor, 'پاک‌سازیِ آگهی‌های تکراری', `${r.removed} حذف، ${r.kept} ماند`)
  return NextResponse.json({ ok: true, ...r })
}
