import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getItemById } from '@/app/lib/scraper-store'
import { moderateOne, moderatePending, moderationModel } from '@/app/lib/moderation'
import { mlStats } from '@/app/lib/moderation-ml'

// GET → وضعیتِ مدلِ یادگیرندهٔ ممیزی (چند نمونه دیده، آماده هست، چند تصمیمِ خودکار زده).
export async function GET() {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ ok: true, ml: mlStats(), hasAiModel: !!moderationModel() })
}

// POST {} → moderate the whole pending queue.  POST {id} → moderate one item.
// مدل تنظیم‌نشده هم مشکلی نیست: مدلِ یادگیرنده اگر آماده باشد خودش تصمیم می‌گیرد.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s || s.role !== 'super_admin') return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const model = moderationModel()

  if (b.id) {
    const it = getItemById(b.id)
    if (!it) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    const r = await moderateOne(it, model)
    return NextResponse.json({ ok: true, moderated: 1, results: [r], ml: mlStats() })
  }

  const { moderated, results, error } = await moderatePending()
  if (error) return NextResponse.json({ error, ml: mlStats() }, { status: 400 })
  return NextResponse.json({ ok: true, moderated, results, ml: mlStats() })
}
