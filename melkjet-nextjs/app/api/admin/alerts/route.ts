import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'

export const runtime = 'nodejs'

// فاز ۳۳۳ — اعلاناتِ ادمین: «چیزهایی که نیاز به توجه دارند». زنگِ ادمین تا امروز تزئینی بود
// (کلیک کاری نمی‌کرد)؛ این endpoint موارد واقعیِ در انتظار را جمع می‌کند تا دراپ‌داون نشان دهد.
async function guard() { const s = await getSession(); return s && (s.role === 'super_admin' || (s.staff || []).length > 0) ? s : null }

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const alerts: { type: string; text: string; count: number; view: string }[] = []

  // آگهی‌های در انتظارِ ممیزی
  try {
    const { pendingForModeration } = await import('@/app/lib/scraper-store')
    const n = (await pendingForModeration(500)).length
    if (n) alerts.push({ type: 'moderation', text: 'آگهیِ در انتظارِ ممیزی', count: n, view: 'moderation' })
  } catch {}

  // نظراتِ در انتظارِ تایید
  try {
    const { pendingReviews } = await import('@/app/lib/reviews-store')
    const n = pendingReviews().length
    if (n) alerts.push({ type: 'reviews', text: 'نظرِ در انتظارِ تایید', count: n, view: 'dirReviews' })
  } catch {}

  // سفارش‌های شارژ/پلن/پروموتِ در انتظارِ تایید
  try {
    const { listOrders } = await import('@/app/lib/comm-store')
    const n = (await listOrders()).filter(o => o.status === 'pending').length
    if (n) alerts.push({ type: 'orders', text: 'سفارشِ شارژ/پلنِ در انتظارِ تایید', count: n, view: 'promos' })
  } catch {}

  // آژانس‌هایی که بیش از ۴۸ ساعت سینکِ موفق نداشته‌اند (هشدارِ کُندیِ روستر)
  try {
    const { listScrapes } = await import('@/app/lib/agency-roster-store')
    const now = Date.now()
    const over = (await listScrapes()).filter(s => (s as any).autoSync !== false && (s as any).schedule !== 'off' && (!s.lastOkAt || now - s.lastOkAt > 48 * 3600_000)).length
    if (over) alerts.push({ type: 'roster', text: 'آژانسِ بیش از ۴۸ ساعت سینک‌نشده', count: over, view: 'agencyintel' })
  } catch {}

  const total = alerts.reduce((a, x) => a + x.count, 0)
  return NextResponse.json({ alerts, total }, { headers: { 'Cache-Control': 'no-store, private' } })
}
