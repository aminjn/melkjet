import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listContacts, listGroups, addContact, updateContact, deleteContact, bulkAddContacts, importFromLeads, recipientsForGroup, addGroup, deleteGroup, assignGroup } from '@/app/lib/contacts-store'

// دفترچهٔ مخاطبینِ مارکتینگ (per-profile).
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای مشاهده وارد شوید' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  // ?recipients=email|sms&group=… → فهرستِ آمادهٔ ارسال (برای فرمِ کمپین)
  const ch = sp.get('recipients')
  if (ch === 'email' || ch === 'sms') {
    return NextResponse.json({ recipients: await recipientsForGroup(s.phone, sp.get('group') || '__all', ch) }, { headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ contacts: await listContacts(s.phone), groups: await listGroups(s.phone) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انجام این عملیات وارد شوید' }, { status: 401 })
  const o = s.phone
  const b = await req.json().catch(() => ({} as any))
  switch (b.action as string) {
    case 'add': return NextResponse.json({ ok: true, contact: await addContact(o, b) })
    case 'update': { if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); const c = await updateContact(o, String(b.id), b.patch || {}); return c ? NextResponse.json({ ok: true, contact: c }) : NextResponse.json({ error: 'یافت نشد' }, { status: 404 }) }
    case 'delete': if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 }); await deleteContact(o, String(b.id)); return NextResponse.json({ ok: true })
    case 'bulk': { const rows = Array.isArray(b.rows) ? b.rows : []; const r = await bulkAddContacts(o, rows, Array.isArray(b.groups) ? b.groups : (b.group ? [String(b.group)] : [])); return NextResponse.json({ ok: true, ...r, groups: await listGroups(o) }) }
    case 'fromLeads': { const r = await importFromLeads(o, b.group ? String(b.group) : undefined); return NextResponse.json({ ok: true, ...r, groups: await listGroups(o) }) }
    case 'addGroup': if (!b.name) return NextResponse.json({ error: 'نام گروه الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, groups: await addGroup(o, String(b.name)) })
    case 'deleteGroup': if (!b.name) return NextResponse.json({ error: 'نام گروه الزامی است' }, { status: 400 }); return NextResponse.json({ ok: true, groups: await deleteGroup(o, String(b.name)) })
    case 'assignGroup': { const ids = Array.isArray(b.ids) ? b.ids.map(String) : []; if (!ids.length || !b.group) return NextResponse.json({ error: 'مخاطب و گروه الزامی است' }, { status: 400 }); await assignGroup(o, ids, String(b.group), b.add !== false); return NextResponse.json({ ok: true, groups: await listGroups(o) }) }
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
