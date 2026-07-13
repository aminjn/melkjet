import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { ownAdvisorClusters, analyzeBrand } from '@/app/lib/agency-intel'
import { logAudit } from '@/app/lib/audit-store'

async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) ? s : null }

// GET → خوشه‌های مشاورهای خودمان بر اساسِ برندِ دیوارِ مشترک (فوری).
export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const clusters = ownAdvisorClusters(1)
  return NextResponse.json({ ok: true, clusters, agencyCount: clusters.filter(c => c.advisors.length >= 2).length })
}

// POST { slug, sample } → تحلیلِ یک برندِ دیوار (آگهی + تخمینِ مشاور از شماره‌های متمایز).
export async function POST(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as Record<string, any>))
  if (!b.slug) return NextResponse.json({ error: 'slug/لینکِ برند الزامی است' }, { status: 400 })
  const r = await analyzeBrand(String(b.slug), Number(b.sample) || 20)
  if (r.ok) logAudit((s as any).name || (s as any).phone || 'مدیر', 'تحلیلِ برندِ دیوار', `${r.slug}: ${r.listings} آگهی، ${r.distinctPhones} شمارهٔ متمایز`)
  return NextResponse.json(r)
}
