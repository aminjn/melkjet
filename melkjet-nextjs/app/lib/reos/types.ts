// ═══════════════════════════════════════════════════════════════════════════
// MelkJet REOS — Real Estate Operating System · Core types
// مونولیتِ ماژولار: هر «سرویس» یک ماژول است؛ Event bus درون‌برنامه‌ای + PG.
// ═══════════════════════════════════════════════════════════════════════════

export type Intent = 'buy' | 'rent' | 'invest'
export type DealType = 'sale' | 'rent'

// بردارِ نهفتهٔ اشتراکی (ابعادِ ثابت) برای شباهتِ برداری (cosine). در PG به‌صورت jsonb
// ذخیره می‌شود؛ مسیرِ ارتقا به pgvector بدونِ تغییرِ منطق است.
export const EMBED_DIM = 64
export type Vector = number[]

// ── User (خریدار/سرمایه‌گذار) ──
export interface UserEntity {
  id: string                    // آیدیِ پروفایل (شماره)
  budget?: number               // تومان
  intent?: Intent
  lat?: number; lng?: number
  locationText?: string
  engagementScore?: number      // ۰..۱ (از رفتار)
  behaviorTokens?: string[]     // توکنِ املاکی که با آن‌ها تعامل کرده (نوع/محله/…)
  interactedPropertyIds?: string[]
}

// ── Property (ملک/آگهی) ──
export interface PropertyEntity {
  id: string
  price?: number
  rentMonthly?: number
  deal?: DealType
  ptype?: string
  lat?: number; lng?: number
  locationText?: string
  area?: number
  rooms?: number
  features?: string[]           // امکانات
  tokens?: string[]             // توکنِ متنی برای embedding
  views?: number
  contacts?: number
  saves?: number
  createdAt?: number
  ownerId?: string
}

// ── Agent (مشاور) ──
export interface AgentEntity {
  id: string                    // آیدیِ پروفایل (شماره)
  name: string
  conversionRate?: number       // ۰..۱
  responseMinutes?: number      // میانگینِ زمانِ پاسخ
  rating?: number               // ۰..۵
  deals?: number
  openLoad?: number             // لیدهای بازِ فعلی
  specialties?: string[]        // منطقه/نوعِ تخصص
  active?: boolean
}

// ── Feature vectors ──
export interface UserVector { id: string; embed: Vector; budget: number; intent: Intent | null; lat: number | null; lng: number | null; engagement: number }
export interface PropertyVector { id: string; embed: Vector; price: number; deal: DealType | null; lat: number | null; lng: number | null; demand: number }
export interface AgentVector { id: string; embed: Vector; perf: number; load: number }

// ── Scoring ──
export interface ScoreBreakdown {
  budgetMatch: number; locationMatch: number; behaviorMatch: number
  intentStrength: number; historicalInteraction: number; marketDemand: number
  final: number
}
export interface Match<T = string> { targetId: T; score: number; breakdown: ScoreBreakdown; reasons: string[] }

// ── Events (Event-driven core) ──
export type EventType =
  | 'user_clicked_property' | 'user_saved_property' | 'user_searched'
  | 'property_created' | 'lead_created' | 'agent_assigned' | 'contact_made'
export interface ReosEvent {
  id: string
  type: EventType
  at: number
  userId?: string
  propertyId?: string
  agentId?: string
  leadId?: string
  meta?: Record<string, unknown>
}

// ── ML outputs ──
export interface Prediction { value: number; confidence: number; features: Record<string, number>; label?: string }
