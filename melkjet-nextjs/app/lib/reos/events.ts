// REOS · Event Processing Pipeline (Event → Feature → AI → Ranking)
// هر رویداد: ثبت در event log → آپدیتِ feature store (online-learning reward) → ابطالِ کشِ توصیه.
import { recordEvent, bumpFeatures } from './store'
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

// ورودیِ رویداد (Event Collector). همهٔ آپدیت‌ها به‌صورتِ درون‌برنامه‌ای (معادلِ Worker) انجام می‌شود.
export async function ingest(input: Omit<ReosEvent, 'id' | 'at'>): Promise<ReosEvent> {
  const ev = await recordEvent(input)
  const reward = REWARD[ev.type] || 0

  // STEP: feature store update
  try {
    if (ev.propertyId) {
      const inc: Record<string, number> = { engagement_score: reward }
      if (ev.type === 'user_clicked_property') inc.click_count = 1
      if (ev.type === 'user_saved_property') inc.save_count = 1
      if (ev.type === 'contact_made') inc.contact_count = 1
      await bumpFeatures('property', ev.propertyId, inc)
    }
    if (ev.userId) {
      const inc: Record<string, number> = {}
      if (ev.type === 'user_clicked_property') inc.click_count = 1
      if (ev.type === 'user_saved_property') inc.save_count = 1
      if (ev.type === 'contact_made') inc.contact_count = 1
      if (ev.type === 'user_searched') inc.search_count = 1
      inc.intent_score = reward   // شدتِ نیت با تعاملِ قوی‌تر بالا می‌رود
      await bumpFeatures('user', ev.userId, inc)
    }
    if (ev.agentId && ev.type === 'agent_assigned') await bumpFeatures('agent', ev.agentId, { assigned_count: 1 })
  } catch { /* پردازش نباید ingest را خراب کند */ }

  // STEP: real-time ranking trigger → ابطالِ فیدِ کاربر
  bumpFeed(ev.userId)
  return ev
}
