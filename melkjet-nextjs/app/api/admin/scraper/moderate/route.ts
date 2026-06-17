import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getItemById } from '@/app/lib/scraper-store'
import { moderateOne, moderatePending, moderationModel } from '@/app/lib/moderation'

// POST {} → moderate the whole pending queue.  POST {id} → moderate one item.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const model = moderationModel()
  if (!model) return NextResponse.json({ error: 'مدلی به ایجنت تأیید (ModerationAgent) داده نشده' }, { status: 400 })

  if (b.id) {
    const it = getItemById(b.id)
    if (!it) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    const r = await moderateOne(it, model)
    return NextResponse.json({ ok: true, moderated: 1, results: [r] })
  }

  const { moderated, results, error } = await moderatePending()
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ ok: true, moderated, results })
}
