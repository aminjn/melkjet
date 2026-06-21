import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// استور پنل «خریدار» — per-owner (هر کاربر فقط دادهٔ خودش).
const DATA_FILE = join(process.cwd(), '.buyer-data.json')

export type DealType = 'sale' | 'rent'
export type ViewingStatus = 'scheduled' | 'done' | 'canceled'
export type OfferStatus = 'pending' | 'accepted' | 'rejected'

export interface SavedProperty {
  id: string; title: string; ptype: string; location: string; area: number; rooms: number
  price: number; deal: DealType; addedAt: number
}
export interface SavedSearch {
  id: string; query: string; ptype?: string; area?: string; priceMax?: number; alerts: boolean; createdAt: number
}
export interface BViewing {
  id: string; propertyTitle: string; advisor?: string; date: string; status: ViewingStatus; createdAt: number
}
export interface BOffer {
  id: string; propertyTitle: string; amount: number; status: OfferStatus; createdAt: number
}
export interface BMessage {
  id: string; from: string; propertyTitle?: string; text: string; unread: boolean; createdAt: number
}
// ── چت با صاحب آگهی ──
export type ChatFrom = 'buyer' | 'owner'
export interface ChatMsg { id: string; from: ChatFrom; text: string; ai?: boolean; createdAt: number }
export interface Conversation {
  id: string; ownerName: string; propertyTitle: string; propertyId?: string; messages: ChatMsg[]; createdAt: number; updatedAt: number
}
// ── دستیار هوشمند خرید (گفتگو با AI) ──
export type AiRole = 'user' | 'assistant'
export interface AiMsg { id: string; role: AiRole; text: string; createdAt: number }

export type VerifyStatus = 'none' | 'pending' | 'verified'
export type PrefDeal = 'sale' | 'rent' | 'both'
export interface BuyerProfile {
  name: string; email?: string; bio?: string
  budget?: number; prefType?: string; dealType?: PrefDeal
  rooms?: number; areaMin?: number; areaMax?: number; areas?: string
  verifyStatus?: VerifyStatus
}
export interface BuyerSettings {
  notifyEmail: boolean; notifySms: boolean; notifyPush: boolean
  alertNewMatch: boolean; alertPriceDrop: boolean; alertMessages: boolean; alertViewingReminder: boolean
  showProfileToAdvisors: boolean; allowContact: boolean; weeklyDigest: boolean
  language: 'fa' | 'en'
}
function defaultSettings(): BuyerSettings {
  return {
    notifyEmail: true, notifySms: true, notifyPush: true,
    alertNewMatch: true, alertPriceDrop: true, alertMessages: true, alertViewingReminder: true,
    showProfileToAdvisors: true, allowContact: true, weeklyDigest: false,
    language: 'fa',
  }
}

export interface BuyerData {
  profile: BuyerProfile
  settings: BuyerSettings
  saved: SavedProperty[]
  searches: SavedSearch[]
  viewings: BViewing[]
  offers: BOffer[]
  messages: BMessage[]
  conversations: Conversation[]
  aiMessages: AiMsg[]
  createdAt: number
}

interface DB { buyers: Record<string, BuyerData> }
function id(p = '') { return p + randomBytes(5).toString('hex') }
function load(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { buyers: {} } }
function save(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

function seed(): BuyerData {
  const now = Date.now(); const day = 86400000
  const sp = (title: string, ptype: string, location: string, area: number, rooms: number, price: number, deal: DealType, ageDays: number): SavedProperty =>
    ({ id: id('s_'), title, ptype, location, area, rooms, price, deal, addedAt: now - ageDays * day })
  const saved: SavedProperty[] = [
    sp('آپارتمان نوساز سعادت‌آباد', 'آپارتمان', 'تهران، سعادت‌آباد', 95, 2, 8500000000, 'sale', 2),
    sp('آپارتمان ۲ خوابه جردن', 'آپارتمان', 'تهران، جردن', 110, 2, 11000000000, 'sale', 5),
    sp('آپارتمان اجاره‌ای ونک', 'آپارتمان', 'تهران، ونک', 80, 2, 1500000000, 'rent', 1),
  ]
  const searches: SavedSearch[] = [
    { id: id('q_'), query: 'آپارتمان ۲ خوابه شمال تهران', ptype: 'آپارتمان', area: 'شمال تهران', priceMax: 10000000000, alerts: true, createdAt: now - 3 * day },
    { id: id('q_'), query: 'رهن کامل ونک تا ۲ میلیارد', ptype: 'آپارتمان', area: 'ونک', priceMax: 2000000000, alerts: false, createdAt: now - 7 * day },
  ]
  const viewings: BViewing[] = [
    { id: id('v_'), propertyTitle: 'آپارتمان نوساز سعادت‌آباد', advisor: 'آژانس ملک برتر', date: '۱۴۰۴/۰۴/۰۲', status: 'scheduled', createdAt: now - 1 * day },
    { id: id('v_'), propertyTitle: 'آپارتمان ۲ خوابه جردن', advisor: 'مشاور رضایی', date: '۱۴۰۴/۰۳/۲۹', status: 'done', createdAt: now - 4 * day },
  ]
  const offers: BOffer[] = [
    { id: id('o_'), propertyTitle: 'آپارتمان نوساز سعادت‌آباد', amount: 8200000000, status: 'pending', createdAt: now - 1 * day },
  ]
  const messages: BMessage[] = [
    { id: id('m_'), from: 'آژانس ملک برتر', propertyTitle: 'آپارتمان نوساز سعادت‌آباد', text: 'سلام، بازدید برای پنجشنبه ساعت ۱۰ هماهنگ شد.', unread: true, createdAt: now - 0.2 * day },
    { id: id('m_'), from: 'مشاور رضایی', propertyTitle: 'آپارتمان ۲ خوابه جردن', text: 'مالک با قیمت پیشنهادی موافق نیست، گزینهٔ مشابه دارم.', unread: true, createdAt: now - 1 * day },
    { id: id('m_'), from: 'پشتیبانی ملک‌جت', text: 'سرچ ذخیره‌شدهٔ شما ۳ مورد جدید دارد.', unread: false, createdAt: now - 2 * day },
  ]
  const conversations: Conversation[] = [
    {
      id: id('c_'), ownerName: 'مالک: آقای کریمی', propertyTitle: 'آپارتمان نوساز سعادت‌آباد',
      createdAt: now - 1 * day, updatedAt: now - 0.3 * day,
      messages: [
        { id: id('cm_'), from: 'buyer', text: 'سلام، این واحد هنوز موجوده؟ امکان بازدید آخر هفته هست؟', createdAt: now - 1 * day },
        { id: id('cm_'), from: 'owner', text: 'سلام، بله موجوده. پنجشنبه یا جمعه بعدازظهر می‌تونم هماهنگ کنم.', createdAt: now - 0.9 * day },
        { id: id('cm_'), from: 'buyer', text: 'عالیه، قیمت نهایی‌تون چقدره؟ کمی انعطاف دارید؟', createdAt: now - 0.4 * day },
        { id: id('cm_'), from: 'owner', text: 'قیمت ۸٫۵ میلیارده، برای خریدار جدی تا ۲۰۰ میلیون قابل مذاکره است.', createdAt: now - 0.3 * day },
      ],
    },
    {
      id: id('c_'), ownerName: 'مشاور رضایی', propertyTitle: 'آپارتمان ۲ خوابه جردن',
      createdAt: now - 5 * day, updatedAt: now - 5 * day,
      messages: [
        { id: id('cm_'), from: 'buyer', text: 'سلام، طبقه و جهت نور این واحد چطوره؟', createdAt: now - 5 * day },
      ],
    },
  ]
  const aiMessages: AiMsg[] = []
  return { profile: { name: 'کاربر ملک‌جت', email: '', bio: '', budget: 10000000000, prefType: 'آپارتمان', dealType: 'sale', rooms: 2, areaMin: 70, areaMax: 130, areas: 'شمال تهران', verifyStatus: 'none' }, settings: defaultSettings(), saved, searches, viewings, offers, messages, conversations, aiMessages, createdAt: now }
}

export function getBuyer(o: string): BuyerData {
  const db = load()
  if (!db.buyers[o]) { db.buyers[o] = seed(); save(db) }
  const b = db.buyers[o]
  // backfill برای دادهٔ قدیمی‌تر
  let dirty = false
  if (!Array.isArray(b.conversations)) { b.conversations = seed().conversations; dirty = true }
  if (!Array.isArray(b.aiMessages)) { b.aiMessages = []; dirty = true }
  if (!b.settings) { b.settings = defaultSettings(); dirty = true }
  if (b.profile && b.profile.verifyStatus === undefined) { b.profile.verifyStatus = 'none'; dirty = true }
  if (dirty) save(db)
  return b
}
function mutate(o: string, fn: (b: BuyerData) => void) { const db = load(); if (!db.buyers[o]) db.buyers[o] = seed(); fn(db.buyers[o]); save(db); return db.buyers[o] }

export function buyerStats(o: string) {
  const b = getBuyer(o)
  const upcoming = b.viewings.filter(v => v.status === 'scheduled')
  const unread = b.messages.filter(m => m.unread)
  const pending = b.offers.filter(x => x.status === 'pending')
  return {
    profile: b.profile,
    kpis: {
      savedCount: b.saved.length,
      searchCount: b.searches.length,
      upcomingViewings: upcoming.length,
      unreadMessages: unread.length,
      pendingOffers: pending.length,
    },
    recentSaved: [...b.saved].sort((a, c) => c.addedAt - a.addedAt).slice(0, 4),
    upcoming: upcoming.slice(0, 5),
    recentMessages: [...b.messages].sort((a, c) => c.createdAt - a.createdAt).slice(0, 5),
  }
}

// ---- Saved properties ----
export function addSaved(o: string, input: Partial<SavedProperty>): SavedProperty {
  let c!: SavedProperty
  mutate(o, b => { c = { id: id('s_'), title: String(input.title || 'ملک'), ptype: String(input.ptype || 'آپارتمان'), location: String(input.location || ''), area: Number(input.area) || 0, rooms: Number(input.rooms) || 0, price: Number(input.price) || 0, deal: input.deal === 'rent' ? 'rent' : 'sale', addedAt: Date.now() }; b.saved.unshift(c) })
  return c
}
export function removeSaved(o: string, sid: string) { mutate(o, b => { b.saved = b.saved.filter(s => s.id !== sid) }) }

// ---- Saved searches ----
export function addSearch(o: string, input: { query: string; ptype?: string; area?: string; priceMax?: number; alerts?: boolean }): SavedSearch {
  let c!: SavedSearch
  mutate(o, b => { c = { id: id('q_'), query: String(input.query || ''), ptype: input.ptype, area: input.area, priceMax: input.priceMax ? Number(input.priceMax) : undefined, alerts: !!input.alerts, createdAt: Date.now() }; b.searches.unshift(c) })
  return c
}
export function toggleSearchAlerts(o: string, qid: string): SavedSearch | null {
  let res: SavedSearch | null = null
  mutate(o, b => { const q = b.searches.find(x => x.id === qid); if (!q) return; q.alerts = !q.alerts; res = q })
  return res
}
export function deleteSearch(o: string, qid: string) { mutate(o, b => { b.searches = b.searches.filter(s => s.id !== qid) }) }

// ---- Viewings ----
export function addViewing(o: string, input: { propertyTitle: string; advisor?: string; date: string }): BViewing {
  let c!: BViewing
  mutate(o, b => { c = { id: id('v_'), propertyTitle: input.propertyTitle, advisor: input.advisor, date: input.date, status: 'scheduled', createdAt: Date.now() }; b.viewings.unshift(c) })
  return c
}
export function setViewingStatus(o: string, vid: string, status: ViewingStatus): BViewing | null {
  let res: BViewing | null = null
  mutate(o, b => { const v = b.viewings.find(x => x.id === vid); if (!v) return; v.status = status; res = v })
  return res
}

// ---- Offers ----
export function addOffer(o: string, input: { propertyTitle: string; amount: number }): BOffer {
  let c!: BOffer
  mutate(o, b => { c = { id: id('o_'), propertyTitle: input.propertyTitle, amount: Number(input.amount) || 0, status: 'pending', createdAt: Date.now() }; b.offers.unshift(c) })
  return c
}
export function withdrawOffer(o: string, oid: string) { mutate(o, b => { b.offers = b.offers.filter(x => x.id !== oid) }) }

// ---- Messages ----
export function markMessageRead(o: string, mid: string): BMessage | null {
  let res: BMessage | null = null
  mutate(o, b => { const m = b.messages.find(x => x.id === mid); if (!m) return; m.unread = false; res = m })
  return res
}
export function markAllRead(o: string) { mutate(o, b => { b.messages.forEach(m => m.unread = false) }) }

// ---- چت با صاحب آگهی ----
export function listConversations(o: string): Conversation[] {
  return [...getBuyer(o).conversations].sort((a, b) => b.updatedAt - a.updatedAt)
}
export function startConversation(o: string, input: { ownerName?: string; propertyTitle: string; text: string }): Conversation {
  let c!: Conversation
  mutate(o, b => {
    const now = Date.now()
    c = {
      id: id('c_'), ownerName: String(input.ownerName || 'صاحب آگهی'), propertyTitle: String(input.propertyTitle || 'ملک'),
      createdAt: now, updatedAt: now,
      messages: [{ id: id('cm_'), from: 'buyer', text: String(input.text || ''), createdAt: now }],
    }
    b.conversations.unshift(c)
  })
  return c
}
export function addChatMessage(o: string, convId: string, from: ChatFrom, text: string, ai = false): Conversation | null {
  let res: Conversation | null = null
  mutate(o, b => {
    const c = b.conversations.find(x => x.id === convId); if (!c) return
    c.messages.push({ id: id('cm_'), from, text, ai: ai || undefined, createdAt: Date.now() })
    c.updatedAt = Date.now(); res = c
  })
  return res
}
export function getConversation(o: string, convId: string): Conversation | null {
  return getBuyer(o).conversations.find(c => c.id === convId) || null
}
// از روی صفحهٔ آگهی: گفتگوی همان ملک را پیدا یا ایجاد می‌کند (بدون پیامِ اولیه).
export function upsertPropertyConversation(o: string, input: { propertyId: string; ownerName?: string; propertyTitle: string }): Conversation {
  let c!: Conversation
  mutate(o, b => {
    const existing = input.propertyId ? b.conversations.find(x => x.propertyId === input.propertyId) : null
    if (existing) { c = existing; return }
    const now = Date.now()
    c = {
      id: id('c_'), ownerName: String(input.ownerName || 'صاحب آگهی'), propertyTitle: String(input.propertyTitle || 'ملک'),
      propertyId: input.propertyId || undefined, createdAt: now, updatedAt: now, messages: [],
    }
    b.conversations.unshift(c)
  })
  return c
}

// ---- دستیار هوشمند (AI) ----
export function listAiMessages(o: string): AiMsg[] { return getBuyer(o).aiMessages }
export function addAiMessage(o: string, role: AiRole, text: string): AiMsg {
  let c!: AiMsg
  mutate(o, b => { c = { id: id('ai_'), role, text, createdAt: Date.now() }; b.aiMessages.push(c) })
  return c
}
export function clearAiMessages(o: string) { mutate(o, b => { b.aiMessages = [] }) }

export function listSaved(o: string) { return getBuyer(o).saved }
export function listSearches(o: string) { return getBuyer(o).searches }
export function listViewings(o: string) { return getBuyer(o).viewings }
export function listOffers(o: string) { return getBuyer(o).offers }
export function listMessages(o: string) { return getBuyer(o).messages }
export function updateBuyerProfile(o: string, patch: Partial<BuyerProfile>) {
  // verifyStatus از این مسیر تغییر نمی‌کند (فقط با requestVerification)
  const clean = { ...patch }; delete (clean as { verifyStatus?: unknown }).verifyStatus
  return mutate(o, b => { Object.assign(b.profile, clean) }).profile
}
export function getBuyerSettings(o: string): BuyerSettings { return getBuyer(o).settings }
export function updateBuyerSettings(o: string, patch: Partial<BuyerSettings>): BuyerSettings {
  return mutate(o, b => { Object.assign(b.settings, patch) }).settings
}
export function requestVerification(o: string): VerifyStatus {
  let res: VerifyStatus = 'pending'
  mutate(o, b => { if (b.profile.verifyStatus !== 'verified') b.profile.verifyStatus = 'pending'; res = b.profile.verifyStatus || 'pending' })
  return res
}
