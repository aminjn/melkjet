import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listScrapes, addScrape, removeScrape, requestRun, graduateAdvisor, getScrape } from '@/app/lib/agency-roster-store'
import { logAudit } from '@/app/lib/audit-store'

async function guard() { const s = await getSession(); return s && s.role === 'super_admin' ? s : null }
const who = (s: any) => s?.name || s?.phone || 'مدیر'

// GET → فهرستِ اسکرپ‌های آژانس (هر کدام با مشاورهایش).
export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ ok: true, scrapes: await listScrapes() })
}

// POST { action } → add | sync | graduate | remove
export async function POST(req: NextRequest) {
  const s = await guard()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({} as Record<string, any>))
  const action = String(b.action || '')

  if (action === 'add') {
    const r = await addScrape({ slug: String(b.slug || ''), agencyName: b.agencyName, useAI: b.useAI, schedule: b.schedule })
    if (r.ok) logAudit(who(s), 'افزودنِ اسکرپِ آژانس', r.scrape!.slug)
    return NextResponse.json(r, { status: r.ok ? 200 : 400 })
  }
  if (action === 'sync') {
    if (!b.id) return NextResponse.json({ error: 'id لازم است' }, { status: 400 })
    const ok = await requestRun(String(b.id))
    return NextResponse.json({ ok, queued: ok, note: ok ? 'در صفِ همگام‌سازیِ اینستنسِ ۰ قرار گرفت' : 'اسکرپ یافت نشد' })
  }
  if (action === 'remove') {
    if (!b.id) return NextResponse.json({ error: 'id لازم است' }, { status: 400 })
    await removeScrape(String(b.id))
    logAudit(who(s), 'حذفِ اسکرپِ آژانس', String(b.id))
    return NextResponse.json({ ok: true })
  }
  if (action === 'graduate') {
    if (!b.id || !b.key || !b.phone) return NextResponse.json({ error: 'id/key/phone لازم است' }, { status: 400 })
    const r = await graduateAdvisor(String(b.id), String(b.key), String(b.phone), b.role ? String(b.role) : undefined)
    if (r.ok) { const sc = await getScrape(String(b.id)); logAudit(who(s), 'ساختِ حسابِ مشاور از آژانس', `${sc?.slug || ''} · ${b.key} → ${b.phone} (${r.moved} فایل)`) }
    return NextResponse.json(r, { status: r.ok ? 200 : 400 })
  }
  return NextResponse.json({ error: 'action نامعتبر' }, { status: 400 })
}
