import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { ingest } from '@/app/lib/reos/events'
import { recentEvents } from '@/app/lib/reos/store'
import type { EventType } from '@/app/lib/reos/types'

const VALID: EventType[] = ['user_clicked_property', 'user_saved_property', 'user_searched', 'property_created', 'lead_created', 'agent_assigned', 'contact_made']

// POST /api/reos/events — Event Collector. userId از session (اگر واردشده) یا body.
export async function POST(req: NextRequest) {
  const s = await getSession()
  const b = await req.json().catch(() => ({} as any))
  const type = String(b.type || '') as EventType
  if (!VALID.includes(type)) return NextResponse.json({ error: 'نوعِ رویداد نامعتبر' }, { status: 400 })
  const ev = await ingest({
    type, userId: b.userId || s?.phone || undefined,
    propertyId: b.propertyId ? String(b.propertyId) : undefined,
    agentId: b.agentId ? String(b.agentId) : undefined,
    leadId: b.leadId ? String(b.leadId) : undefined,
    meta: (b.meta && typeof b.meta === 'object') ? b.meta : {},
  })
  return NextResponse.json({ ok: true, event: ev }, { headers: { 'Cache-Control': 'no-store' } })
}

// GET /api/reos/events?userId=&propertyId=&type=&limit=
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const s = await getSession()
  const userId = sp.get('userId') || s?.phone || undefined
  const events = await recentEvents({ userId, propertyId: sp.get('propertyId') || undefined, type: (sp.get('type') as EventType) || undefined, limit: Number(sp.get('limit')) || 100 })
  return NextResponse.json({ ok: true, events }, { headers: { 'Cache-Control': 'no-store' } })
}
