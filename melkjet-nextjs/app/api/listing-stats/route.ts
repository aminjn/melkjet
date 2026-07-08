import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listItems } from '@/app/lib/scraper-store'
import { displayReason } from '@/app/lib/moderation'
import { recordView, recordContact, getStat, forIds } from '@/app/lib/listing-stats-store'
import { ingest } from '@/app/lib/reos/events'

// GET ?id=…        → آمارِ یک آگهی
// GET ?mine=1      → آگهی‌های کاربرِ واردشده + آمارشان (برای گزارشِ پنل)
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  if (sp.get('mine') === '1') {
    const s = await getSession()
    if (!s) return NextResponse.json({ listings: [], totals: { views: 0, contacts: 0 } }, { status: 401 })
    const mine = (await listItems('listing')).filter(it => String(it.meta?.__ownerPhone || '') === s.phone)
    const stats = await forIds(mine.map(it => it.id))
    // وضعیتِ ممیزی + دلیلِ آن به پنلِ کاربر می‌رود — کاربر باید بداند آگهی‌اش چرا رد/معلق شده تا اصلاحش کند.
    const listings = mine.map(it => ({ id: it.id, title: it.title, location: it.location || '', price: it.price || '', image: it.image, status: it.status || 'pending', modReason: displayReason(it), views: stats[it.id].views, contacts: stats[it.id].contacts, lastView: stats[it.id].lastView }))
      .sort((a, b) => (b.views + b.contacts * 3) - (a.views + a.contacts * 3))
    const totals = listings.reduce((t, l) => ({ views: t.views + l.views, contacts: t.contacts + l.contacts }), { views: 0, contacts: 0 })
    return NextResponse.json({ listings, totals }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const id = sp.get('id') || ''
  if (!id) return NextResponse.json({ error: 'id لازم است' }, { status: 400 })
  return NextResponse.json({ stat: await getStat(id) }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST { action:'view'|'contact', id } — تماس نیاز به ورود دارد
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any))
  const id = String(b.id || '')
  if (!id) return NextResponse.json({ error: 'id لازم است' }, { status: 400 })
  const s = await getSession()
  if (b.action === 'contact') {
    if (!s) return NextResponse.json({ error: 'برای دیدن اطلاعات تماس وارد شوید', needLogin: true }, { status: 401 })
    await recordContact(id)
    // REOS: سیگنالِ تماس (قوی‌ترین سیگنالِ نیت) → feature store + یادگیریِ آنلاین
    try { await ingest({ type: 'contact_made', propertyId: id, userId: s.phone }) } catch {}
    return NextResponse.json({ ok: true })
  }
  await recordView(id)
  // REOS: سیگنالِ بازدید (userId اگر واردشده باشد؛ وگرنه فقط ویژگیِ ملک بالا می‌رود)
  try { await ingest({ type: 'user_clicked_property', propertyId: id, userId: s?.phone }) } catch {}
  return NextResponse.json({ ok: true })
}
