import { NextRequest, NextResponse } from 'next/server'
import { addContact } from '@/app/lib/contact-log-store'

export const dynamic = 'force-dynamic'

// درخواستِ بازدید/رزروِ واحد از صفحهٔ عمومیِ پروژه → در «گزارشِ تماس‌ها»ی سازنده ثبت می‌شود.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const builderId = String(b.builderId || '')
  if (!builderId) return NextResponse.json({ ok: false }, { status: 400 })
  const unit = b.unit ? ` — واحد ${b.unit}` : ''
  addContact(builderId, {
    viewerPhone: String(b.phone || '—'), viewerName: b.name || undefined,
    projectHashId: b.projectHash || undefined, projectName: `${b.projectName || 'پروژه'}${unit}`, at: Date.now(),
  })
  return NextResponse.json({ ok: true })
}
