import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listContacts, listGroups, addContact, updateContact, deleteContact, bulkAddContacts, importFromLeads, recipientsForGroup } from '@/app/lib/contacts-store'

// دفترچهٔ مخاطبینِ مارکتینگ (per-profile).
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  // ?recipients=email|sms&group=… → فهرستِ آمادهٔ ارسال (برای فرمِ کمپین)
  const ch = sp.get('recipients')
  if (ch === 'email' || ch === 'sms') {
    return NextResponse.json({ recipients: recipientsForGroup(s.phone, sp.get('group') || '__all', ch) }, { headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ contacts: listContacts(s.phone), groups: listGroups(s.phone) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const o = s.phone
  const b = await req.json().catch(() => ({} as any))
  switch (b.action as string) {
    case 'add': return NextResponse.json({ ok: true, contact: addContact(o, b) })
    case 'update': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const c = updateContact(o, String(b.id), b.patch || {}); return c ? NextResponse.json({ ok: true, contact: c }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'delete': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); deleteContact(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'bulk': { const rows = Array.isArray(b.rows) ? b.rows : []; const r = bulkAddContacts(o, rows, Array.isArray(b.groups) ? b.groups : []); return NextResponse.json({ ok: true, ...r }) }
    case 'fromLeads': return NextResponse.json({ ok: true, ...importFromLeads(o) })
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
