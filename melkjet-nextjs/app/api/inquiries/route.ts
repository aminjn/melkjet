import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listMyInquiries, listReceivedInquiries } from '@/app/lib/materials-store'

export const dynamic = 'force-dynamic'

// هر کاربر می‌تواند هم‌زمان پرسنده و پاسخ‌دهنده باشد، پس هر دو سمت با هم برمی‌گردد.
// نشست‌محور: هیچ شماره‌ای از بیرون پذیرفته نمی‌شود.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ login: true, error: 'برای دیدنِ استعلام‌ها وارد شوید' }, { status: 401 })
  const [sent, received] = await Promise.all([listMyInquiries(s.phone), listReceivedInquiries(s.phone)])
  return NextResponse.json({ ok: true, sent, received })
}
