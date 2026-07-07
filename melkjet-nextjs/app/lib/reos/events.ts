// REOS · Event Processing Pipeline (Event → Feature → AI → Ranking)
// هر رویداد: enqueue در صفِ حافظه (بدونِ بلاک‌کردنِ درخواست) → فلاشرِ پس‌زمینه به event log +
// feature store (online-learning reward) می‌نویسد → کشِ فیدِ کاربر «کهنه» می‌شود.
import { randomBytes } from 'crypto'
import { enqueueEvent, enqueueFeature } from './queue'
import type { ReosEvent, EventType } from './types'

// پاداشِ یادگیریِ آنلاین (وزنِ سیگنال‌ها): کلیک +۱، سیو +۵، تماس +۲۰، معامله +۱۰۰، نادیده −۲.
export const REWARD: Record<EventType, number> = {
  user_clicked_property: 1,
  user_saved_property: 5,
  user_searched: 1,
  contact_made: 20,
  property_created: 0,
  lead_created: 3,
  agent_assigned: 2,
}

// کشِ ابطال‌شونده: هر رویداد فیدِ کاربر را «کهنه» می‌کند تا در خواندنِ بعدی از نو ساخته شود.
const feedStamp = new Map<string, number>()
export function feedVersion(userId: string): number { return feedStamp.get(userId) || 0 }
function bumpFeed(userId?: string) { if (userId) feedStamp.set(userId, Date.now()) }

function uid(): string { return 'ev_' + randomBytes(6).toString('hex') }

// ورودیِ رویداد (Event Collector). فقط enqueue می‌کند و فوراً برمی‌گردد — نوشتنِ DB در پس‌زمینه.
export async function ingest(input: Omit<ReosEvent, 'id' | 'at'> & { at?: number }): Promise<ReosEvent> {
  const ev: ReosEvent = { id: uid(), at: input.at || Date.now(), type: input.type, userId: input.userId, propertyId: input.propertyId, agentId: input.agentId, leadId: input.leadId, meta: input.meta || {} }
  const reward = REWARD[ev.type] || 0

  // STEP: append to event log (async، coalesced)
  enqueueEvent(ev)

  // STEP: feature store update (online-learning reward) — coalesced در صف
  if (ev.propertyId) {
    const inc: Record<string, number> = { engagement_score: reward }
    if (ev.type === 'user_clicked_property') inc.click_count = 1
    if (ev.type === 'user_saved_property') inc.save_count = 1
    if (ev.type === 'contact_made') inc.contact_count = 1
    enqueueFeature('property', ev.propertyId, inc)
  }
  if (ev.userId) {
    const inc: Record<string, number> = { intent_score: reward }
    if (ev.type === 'user_clicked_property') inc.click_count = 1
    if (ev.type === 'user_saved_property') inc.save_count = 1
    if (ev.type === 'contact_made') inc.contact_count = 1
    if (ev.type === 'user_searched') inc.search_count = 1
    enqueueFeature('user', ev.userId, inc)
  }
  if (ev.agentId && ev.type === 'agent_assigned') enqueueFeature('agent', ev.agentId, { assigned_count: 1 })

  // STEP: real-time ranking trigger → ابطالِ فیدِ کاربر (درجا، حافظه)
  bumpFeed(ev.userId)
  return ev
}
