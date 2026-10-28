import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { saveDraft } from '@/app/lib/site-draft-store'

// فاز ۳۳۹ب — ویرایشگر پیش‌نویسِ فعلی را این‌جا می‌فرستد تا /site-preview آن را با موتورِ واقعیِ سایت رندر کند.
// فقط برای خودِ کاربر (کلید = شمارهٔ نشست)؛ هیچ اثری روی سایتِ منتشرشده ندارد.
const MAX_BYTES = 900_000

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای پیش‌نمایش وارد شوید' }, { status: 401 })
  const raw = await req.text()
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: 'پیش‌نویس بیش از حد بزرگ است' }, { status: 413 })
  let b: any
  try { b = JSON.parse(raw) } catch { return NextResponse.json({ error: 'دادهٔ نامعتبر' }, { status: 400 }) }
  if (!Array.isArray(b?.pages)) return NextResponse.json({ error: 'صفحه‌ها لازم است' }, { status: 400 })
  await saveDraft(s.phone, {
    slug: String(b.slug || ''),
    at: Date.now(),
    input: { title: String(b.title || ''), ownerName: b.ownerName ? String(b.ownerName) : undefined, theme: b.theme, seo: b.seo, pages: b.pages, owner: s.phone },
  })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
