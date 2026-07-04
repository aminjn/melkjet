import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getAccount, dashForRole } from '@/app/lib/account-store'
import {
  listAgencies, getAdvisorMembership, listAgencyMembers, requestsForAdvisor, requestsForAgency,
  advisorRequestJoin, agencyInvite, respondRequest, cancelRequest, removeMembership,
} from '@/app/lib/agency-link-store'

function isAgency(phone: string): boolean {
  const a = getAccount(phone); return dashForRole(a?.role) === '/agency'
}

export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const agency = isAgency(s.phone)
  const body = agency
    ? { role: 'agency' as const, members: await listAgencyMembers(s.phone), requests: await requestsForAgency(s.phone) }
    : { role: 'advisor' as const, membership: await getAdvisorMembership(s.phone), requests: await requestsForAdvisor(s.phone), agencies: await listAgencies() }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store, private' } })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = String(b.action || '')
  const agency = isAgency(s.phone)

  switch (action) {
    // ── سمت مشاور ──
    case 'requestJoin': {
      if (agency) return NextResponse.json({ error: 'این عملیات برای مشاور است' }, { status: 400 })
      const r = await advisorRequestJoin(s.phone, String(b.agencyPhone || ''))
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 200 })
    }
    case 'leave': {
      const m = await getAdvisorMembership(s.phone); if (m) removeMembership(s.phone, m.agencyPhone)
      return NextResponse.json({ ok: true })
    }
    // ── سمت آژانس ──
    case 'invite': {
      if (!agency) return NextResponse.json({ error: 'این عملیات برای آژانس است' }, { status: 400 })
      const r = await agencyInvite(s.phone, String(b.advisorPhone || '').replace(/\D/g, ''))
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 200 })
    }
    case 'remove': {
      if (!agency) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
      removeMembership(String(b.advisorPhone || ''), s.phone)
      return NextResponse.json({ ok: true })
    }
    // ── مشترک ──
    case 'respond': {
      const r = respondRequest(String(b.id || ''), s.phone, !!b.accept)
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 200 })
    }
    case 'cancel': { cancelRequest(String(b.id || ''), s.phone); return NextResponse.json({ ok: true }) }
    default: return NextResponse.json({ error: 'عملیات نامعتبر' }, { status: 400 })
  }
}
