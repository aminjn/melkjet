import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listMyInquiries, listReceivedInquiries } from '@/app/lib/materials-store'
import { listMyPropertyInquiries, listReceivedPropertyInquiries } from '@/app/lib/owner-store'

export const dynamic = 'force-dynamic'

// One shape for every inquiry flow. Each store keeps its own field names, so the
// mapping lives here and the page knows a single type. Adding the next flow
// (architect) is a few lines below, with no change to the page.
export type InquiryKind = 'materials' | 'property'
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
}

const MELK = '\u0645\u0644\u06a9'

export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ login: true, error: '\u0628\u0631\u0627\u06cc \u062f\u06cc\u062f\u0646\u0650 \u0627\u0633\u062a\u0639\u0644\u0627\u0645\u200c\u0647\u0627 \u0648\u0627\u0631\u062f \u0634\u0648\u06cc\u062f' }, { status: 401 })
  const [ms, mr, ps, pr] = await Promise.all([
    listMyInquiries(s.phone), listReceivedInquiries(s.phone),
    listMyPropertyInquiries(s.phone), listReceivedPropertyInquiries(s.phone),
  ])
  const answered = (st: string): 'new' | 'answered' => (st === 'answered' ? 'answered' : 'new')
  const sent: InquiryItem[] = [
    ...ms.map(q => ({ id: q.id, kind: 'materials' as const, title: q.product, sub: q.qty, note: q.note,
      status: answered(q.status), reply: q.reply, createdAt: q.createdAt,
      counterparty: q.shopName, href: q.shopSlug ? '/store/' + q.shopSlug : undefined })),
    ...ps.map(q => ({ id: q.id, kind: 'property' as const, title: q.propertyTitle || MELK, sub: undefined, note: q.message,
      status: answered(q.status), reply: q.reply, createdAt: q.createdAt,
      counterparty: q.ownerName, href: undefined })),
  ].sort((a, b) => b.createdAt - a.createdAt)
  const received: InquiryItem[] = [
    ...mr.map(q => ({ id: q.id, kind: 'materials' as const, title: q.product, sub: q.qty, note: q.note,
      status: answered(q.status), reply: q.reply, createdAt: q.createdAt,
      counterparty: q.customer, answerHref: '/materials' })),
    ...pr.map(q => ({ id: q.id, kind: 'property' as const, title: q.propertyTitle || MELK, sub: undefined, note: q.message,
      status: answered(q.status), reply: q.reply, createdAt: q.createdAt,
      counterparty: q.name, answerHref: '/owner' })),
  ].sort((a, b) => b.createdAt - a.createdAt)
  return NextResponse.json({ ok: true, sent, received })
}
