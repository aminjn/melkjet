import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount } from '@/app/lib/account-store'
import { resolveProvider } from '@/app/lib/provider-public'
import { addPublicRequest } from '@/app/lib/prodesk-store'

export const dynamic = 'force-dynamic'

// The public entry point the seven ProDesk panels were missing: their inquiry
// inbox existed but nothing outside the panel could ever write to it.
const ROLES = ['/architect', '/contractor', '/appraiser', '/lawfirm', '/finance', '/notary', '/legal']

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ login: true, error: '\u0628\u0631\u0627\u06cc \u0627\u0631\u0633\u0627\u0644\u0650 \u0627\u0633\u062a\u0639\u0644\u0627\u0645 \u0648\u0627\u0631\u062f \u0634\u0648\u06cc\u062f' }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const detail = String(b.detail || '').trim()
  if (!detail) return NextResponse.json({ error: '\u0645\u062a\u0646\u0650 \u0627\u0633\u062a\u0639\u0644\u0627\u0645 \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a' }, { status: 400 })

  // The professional is resolved server-side from (type, slug). The client never
  // sends a phone, so a request cannot be aimed at somebody else's inbox.
  const p = await resolveProvider(String(b.type || ''), String(b.slug || ''))
  if (!p || !p.phone) return NextResponse.json({ error: '\u0645\u062a\u062e\u0635\u0635 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f' }, { status: 404 })
  const role = '/' + p.type
  if (!ROLES.includes(role)) return NextResponse.json({ error: '\u0627\u06cc\u0646 \u0646\u0642\u0634 \u0627\u0633\u062a\u0639\u0644\u0627\u0645 \u0646\u0645\u06cc\u200c\u067e\u0630\u06cc\u0631\u062f' }, { status: 400 })
  if (p.phone === s.phone) return NextResponse.json({ error: '\u0627\u06cc\u0646 \u067e\u0631\u0648\u0641\u0627\u06cc\u0644\u0650 \u062e\u0648\u062f\u0650 \u0634\u0645\u0627\u0633\u062a' }, { status: 400 })

  const r = await addPublicRequest(p.phone, role, {
    clientName: getAccount(s.phone)?.name || '\u06a9\u0627\u0631\u0628\u0631',
    clientPhone: s.phone,
    customerPhone: s.phone,
    kind: String(b.kind || '').trim().slice(0, 60) || undefined,
    detail: detail.slice(0, 1000),
  })
  return NextResponse.json({ ok: true, id: r.id })
}
