import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { dedupeListings } from '@/app/lib/listing-dedupe'
import { logAudit } from '@/app/lib/audit-store'

// پاک‌سازیِ آگهی‌های تکراری (فقط سوپرادمین). قدیمی‌ترینِ هر گروه می‌ماند، بقیه «duplicate» می‌شوند.
export async function POST() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const r = dedupeListings()
  logAudit((s as any).name || (s as any).phone || 'مدیر', 'پاک‌سازیِ آگهی‌های تکراری', `${r.removed} حذف، ${r.kept} ماند`)
  return NextResponse.json({ ok: true, ...r })
}
