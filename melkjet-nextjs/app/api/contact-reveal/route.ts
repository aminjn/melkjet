import { NextRequest, NextResponse } from 'next/server'
import { requireAndBumpUsage } from '@/app/lib/plan-usage'
import { getSession } from '@/app/lib/session'
import { getProfile } from '@/app/lib/persiansaze-store'
import { getPublic } from '@/app/lib/builder-public-store'
import { getAccount } from '@/app/lib/account-store'
import { addContact } from '@/app/lib/contact-log-store'

export const dynamic = 'force-dynamic'

// نمایشِ شمارهٔ سازنده فقط برای کاربرِ واردشده + ثبتِ تماس برای گزارشِ سازنده.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای دیدنِ شماره ابتدا وارد شوید', login: true }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const builderId = String(b.builderId || '')
  const prof = getProfile(builderId)
  if (!prof) return NextResponse.json({ error: 'سازنده پیدا نشد' }, { status: 404 })

  { const u52 = await requireAndBumpUsage(s as any, 'contactReveals', 1); if (u52) return NextResponse.json(u52, { status: 403 }) }   // فاز ۵۲: سهمیهٔ ماهانهٔ پلن
  const phone = getPublic(builderId).phonePublic || (prof.phones || [])[0] || ''
  if (!phone) return NextResponse.json({ error: 'شماره‌ای ثبت نشده است' }, { status: 404 })

  // تماس را ثبت کن (مگر اینکه بیننده خودِ سازنده باشد).
  const norm = (p: string) => String(p).replace(/\D/g, '')
  const isOwner = (prof.phones || []).some(ph => norm(ph) === norm(s.phone))
  if (!isOwner) {
    await addContact(builderId, {
      viewerPhone: s.phone, viewerName: getAccount(s.phone)?.name,
      projectHashId: b.projectHashId || undefined, projectName: b.projectName || undefined, at: Date.now(),
    })
  }
  return NextResponse.json({ ok: true, phone })
}
