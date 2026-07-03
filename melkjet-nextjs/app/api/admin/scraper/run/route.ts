import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listSources, insertItems, markError } from '@/app/lib/scraper-store'
import { scrapeSource } from '@/app/lib/scraper-engine'
import { moderatePending } from '@/app/lib/moderation'
import { dedupeListings } from '@/app/lib/listing-dedupe'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

// Run one source (by id) or all enabled sources. Returns per-source results.
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const all = listSources()
  const targets = body.id ? all.filter(s => s.id === body.id) : all.filter(s => s.enabled)
  if (!targets.length) return NextResponse.json({ error: 'منبعی برای اجرا یافت نشد' }, { status: 404 })

  const results = []
  let totalAdded = 0, totalDup = 0
  for (const src of targets) {
    try {
      const raw = await scrapeSource(src)
      if (!raw.length) {
        markError(src.id, 'هیچ داده‌ای استخراج نشد (ساختار صفحه پشتیبانی نشد یا نیاز به RSS/JSON-LD دارد)')
        results.push({ source: src.name, ok: false, added: 0, dup: 0, error: 'بدون داده' })
        continue
      }
      const { added, dup } = insertItems(src, raw)
      totalAdded += added; totalDup += dup
      results.push({ source: src.name, ok: true, added, dup })
    } catch (e: any) {
      const msg = e?.message || 'خطای ناشناخته'
      markError(src.id, msg)
      results.push({ source: src.name, ok: false, added: 0, dup: 0, error: msg })
    }
  }

  // تأیید خودکار فوری: هر آگهی تازه‌واکشی‌شده بلافاصله توسط هوش مصنوعی تأیید/رد می‌شود
  let moderated = 0
  if (totalAdded > 0) {
    try { moderated = (await moderatePending()).moderated } catch { /* اگر مدل تنظیم نشده باشد */ }
  }
  // حذفِ آگهی‌های تکراری (SEO): از هر گروهِ مشابه فقط قدیمی‌ترین می‌ماند.
  let deduped = 0
  if (totalAdded > 0) { try { deduped = dedupeListings().removed } catch {} }

  return NextResponse.json({ ok: true, totalAdded, totalDup, moderated, deduped, results, sources: listSources() })
}
