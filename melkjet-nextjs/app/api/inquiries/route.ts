import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listMyInquiries, listReceivedInquiries, answerInquiry as answerMaterials } from '@/app/lib/materials-store'
import { listMyPropertyInquiries, listReceivedPropertyInquiries, answerInquiry as answerProperty } from '@/app/lib/owner-store'
import { listMyProRequests, listReceivedProRequests, answerRequest } from '@/app/lib/prodesk-store'

export const dynamic = 'force-dynamic'

// One shape for every inquiry flow. Each store keeps its own field names, so the
// mapping lives here and the page knows a single type. Adding the next flow is a
// few lines below, with no change to the page.
export type InquiryKind = 'materials' | 'property' | 'pro'
export interface InquiryItem {
  id: string
  kind: InquiryKind
  title: string
  sub?: string
  note?: string
  status: 'new' | 'answered'
  reply?: string
  createdAt: number
  counterparty: string
  href?: string
  answerHref?: string
  role?: string        // pro only: which dashboard the request belongs to
}

const MELK = '\u0645\u0644\u06a9'
const ESTELAM = '\u0627\u0633\u062a\u0639\u0644\u0627\u0645'
const answered = (st: string): 'new' | 'answered' => (st === 'answered' ? 'answered' : 'new')

export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ login: true, error: '\u0628\u0631\u0627\u06cc \u062f\u06cc\u062f\u0646\u0650 \u0627\u0633\u062a\u0639\u0644\u0627\u0645\u200c\u0647\u0627 \u0648\u0627\u0631\u062f \u0634\u0648\u06cc\u062f' }, { status: 401 })
  const [ms, mr, ps, pr, qs, qr] = await Promise.all([
    listMyInquiries(s.phone), listReceivedInquiries(s.phone),
    listMyPropertyInquiries(s.phone), listReceivedPropertyInquiries(s.phone),
    listMyProRequests(s.phone), listReceivedProRequests(s.phone),
  ])
  const sent: InquiryItem[] = [
    ...ms.map(q => ({ id: q.id, kind: 'materials' as const, title: q.product, sub: q.qty, note: q.note,
      status: answered(q.status), reply: q.reply, createdAt: q.createdAt,
      counterparty: q.shopName, href: q.shopSlug ? '/store/' + q.shopSlug : undefined })),
    ...ps.map(q => ({ id: q.id, kind: 'property' as const, title: q.propertyTitle || MELK, sub: undefined, note: q.message,
      status: answered(q.status), reply: q.reply, createdAt: q.createdAt,
      counterparty: q.ownerName, href: undefined })),
    ...qs.map(q => ({ id: q.id, kind: 'pro' as const, title: q.kind || ESTELAM, sub: q.roleLabel, note: q.detail,
      status: answered(q.status), reply: q.reply, createdAt: q.createdAt,
      counterparty: q.proName, href: undefined })),
  ].sort((a, b) => b.createdAt - a.createdAt)
  const received: InquiryItem[] = [
    ...mr.map(q => ({ id: q.id, kind: 'materials' as const, title: q.product, sub: q.qty, note: q.note,
      status: answered(q.status), reply: q.reply, createdAt: q.createdAt,
      counterparty: q.customer, answerHref: '/materials' })),
    ...pr.map(q => ({ id: q.id, kind: 'property' as const, title: q.propertyTitle || MELK, sub: undefined, note: q.message,
      status: answered(q.status), reply: q.reply, createdAt: q.createdAt,
      counterparty: q.name, answerHref: '/owner' })),
    ...qr.map(q => ({ id: q.id, kind: 'pro' as const, title: q.kind || ESTELAM, sub: q.roleLabel, note: q.detail,
      status: answered(q.status), reply: q.reply, createdAt: q.createdAt,
      counterparty: q.clientName, answerHref: undefined, role: q.role })),
  ].sort((a, b) => b.createdAt - a.createdAt)
  return NextResponse.json({ ok: true, sent, received })
}

// Answering happens here for every flow, so there is one place a reply can be
// sent from instead of one per panel. The owner is always the session phone, so
// a caller can only answer what was addressed to them; each store re-checks.
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: '\u0628\u0631\u0627\u06cc \u067e\u0627\u0633\u062e \u0648\u0627\u0631\u062f \u0634\u0648\u06cc\u062f' }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const id = String(b.id || '')
  const reply = String(b.reply || '').trim()
  if (!id || !reply) return NextResponse.json({ error: '\u0645\u062a\u0646\u0650 \u067e\u0627\u0633\u062e \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a' }, { status: 400 })

  let done: unknown = null
  if (b.kind === 'materials') done = await answerMaterials(s.phone, id, reply)
  else if (b.kind === 'property') done = await answerProperty(s.phone, id, reply)
  else if (b.kind === 'pro') done = await answerRequest(s.phone, String(b.role || ''), id, reply)
  else return NextResponse.json({ error: '\u0646\u0648\u0639\u0650 \u0646\u0627\u0645\u0639\u062a\u0628\u0631' }, { status: 400 })

  if (!done) return NextResponse.json({ error: '\u06cc\u0627\u0641\u062a \u0646\u0634\u062f' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
