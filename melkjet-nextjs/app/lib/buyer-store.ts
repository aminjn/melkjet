import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// استور پنل «خریدار» — per-owner (هر کاربر فقط دادهٔ خودش).
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.buyer-data.json')
const KV_KEY = 'buyer'

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
// هر گفتگوی دستیار هوشمند جداگانه ذخیره می‌شود تا کاربر بعداً مرور کند.
export interface AiChat { id: string; title: string; messages: AiMsg[]; createdAt: number; updatedAt: number }

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
  aiChats: AiChat[]
  createdAt: number
}

interface DB { buyers: Record<string, BuyerData> }
function id(p = '') { return p + randomBytes(5).toString('hex') }
function fileLoad(): DB { if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} } return { buyers: {} } }
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)) }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { buyers: {} }) : fileLoad() }
// wrapperِ عمومیِ خواندن-تغییر-نوشتن (نامش withDb تا با mutate(owner) پایین تداخل نکند)
async function withDb<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { buyers: {} }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

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
  const aiChats: AiChat[] = []
  return { profile: { name: 'کاربر ملک‌جت', email: '', bio: '', budget: 10000000000, prefType: 'آپارتمان', dealType: 'sale', rooms: 2, areaMin: 70, areaMax: 130, areas: 'شمال تهران', verifyStatus: 'none' }, settings: defaultSettings(), saved, searches, viewings, offers, messages, conversations, aiChats, createdAt: now }
}

// seed/backfill را روی db برای مالکِ o اعمال می‌کند؛ برمی‌گرداند که آیا چیزی تغییر کرد (نیاز به ذخیره).
function applyBuyer(db: DB, o: string): boolean {
  let dirty = false
  if (!db.buyers[o]) { db.buyers[o] = seed(); dirty = true }
  const b = db.buyers[o]
  // backfill برای دادهٔ قدیمی‌تر
  if (!Array.isArray(b.conversations)) { b.conversations = seed().conversations; dirty = true }
  if (!Array.isArray(b.aiChats)) {
    // مهاجرت: تبدیلِ aiMessages تخت قدیمی به یک گفتگو
    const legacy = (b as unknown as { aiMessages?: AiMsg[] }).aiMessages
    if (Array.isArray(legacy) && legacy.length) {
      const now = Date.now()
      b.aiChats = [{ id: id('ac_'), title: chatTitleFrom(legacy), messages: legacy, createdAt: legacy[0]?.createdAt || now, updatedAt: now }]
    } else { b.aiChats = [] }
    delete (b as unknown as { aiMessages?: AiMsg[] }).aiMessages
    dirty = true
  }
  if (!b.settings) { b.settings = defaultSettings(); dirty = true }
  if (b.profile && b.profile.verifyStatus === undefined) { b.profile.verifyStatus = 'none'; dirty = true }
  return dirty
}

export async function getBuyer(o: string): Promise<BuyerData> {
  const db = await load()
  // اگر seed/backfill لازم نبود، بدونِ نوشتن برگردان (مثلِ قبل که فقط وقتی dirty بود ذخیره می‌شد).
  if (!applyBuyer(db, o)) return db.buyers[o]
  return withDb(d => { applyBuyer(d, o); return d.buyers[o] })
}
// عنوانِ گفتگو از اولین پیامِ کاربر
function chatTitleFrom(messages: AiMsg[]): string {
  const first = messages.find(m => m.role === 'user')?.text || 'گفتگوی جدید'
  return first.trim().slice(0, 40) || 'گفتگوی جدید'
}
async function mutate(o: string, fn: (b: BuyerData) => void): Promise<BuyerData> {
  return withDb(db => { if (!db.buyers[o]) db.buyers[o] = seed(); fn(db.buyers[o]); return db.buyers[o] })
}

export async function buyerStats(o: string) {
  const b = await getBuyer(o)
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
export async function addSaved(o: string, input: Partial<SavedProperty>): Promise<SavedProperty> {
  let c!: SavedProperty
  await mutate(o, b => { c = { id: id('s_'), title: String(input.title || 'ملک'), ptype: String(input.ptype || 'آپارتمان'), location: String(input.location || ''), area: Number(input.area) || 0, rooms: Number(input.rooms) || 0, price: Number(input.price) || 0, deal: input.deal === 'rent' ? 'rent' : 'sale', addedAt: Date.now() }; b.saved.unshift(c) })
  return c
}
export async function removeSaved(o: string, sid: string): Promise<void> { await mutate(o, b => { b.saved = b.saved.filter(s => s.id !== sid) }) }

// ---- Saved searches ----
export async function addSearch(o: string, input: { query: string; ptype?: string; area?: string; priceMax?: number; alerts?: boolean }): Promise<SavedSearch> {
  let c!: SavedSearch
  await mutate(o, b => { c = { id: id('q_'), query: String(input.query || ''), ptype: input.ptype, area: input.area, priceMax: input.priceMax ? Number(input.priceMax) : undefined, alerts: !!input.alerts, createdAt: Date.now() }; b.searches.unshift(c) })
  return c
}
export async function toggleSearchAlerts(o: string, qid: string): Promise<SavedSearch | null> {
  let res: SavedSearch | null = null
  await mutate(o, b => { const q = b.searches.find(x => x.id === qid); if (!q) return; q.alerts = !q.alerts; res = q })
  return res
}
export async function deleteSearch(o: string, qid: string): Promise<void> { await mutate(o, b => { b.searches = b.searches.filter(s => s.id !== qid) }) }

// ---- Viewings ----
export async function addViewing(o: string, input: { propertyTitle: string; advisor?: string; date: string }): Promise<BViewing> {
  let c!: BViewing
  await mutate(o, b => { c = { id: id('v_'), propertyTitle: input.propertyTitle, advisor: input.advisor, date: input.date, status: 'scheduled', createdAt: Date.now() }; b.viewings.unshift(c) })
  return c
}
export async function setViewingStatus(o: string, vid: string, status: ViewingStatus): Promise<BViewing | null> {
  let res: BViewing | null = null
  await mutate(o, b => { const v = b.viewings.find(x => x.id === vid); if (!v) return; v.status = status; res = v })
  return res
}

// ---- Offers ----
export async function addOffer(o: string, input: { propertyTitle: string; amount: number }): Promise<BOffer> {
  let c!: BOffer
  await mutate(o, b => { c = { id: id('o_'), propertyTitle: input.propertyTitle, amount: Number(input.amount) || 0, status: 'pending', createdAt: Date.now() }; b.offers.unshift(c) })
  return c
}
export async function withdrawOffer(o: string, oid: string): Promise<void> { await mutate(o, b => { b.offers = b.offers.filter(x => x.id !== oid) }) }

// ---- Messages ----
export async function markMessageRead(o: string, mid: string): Promise<BMessage | null> {
  let res: BMessage | null = null
  await mutate(o, b => { const m = b.messages.find(x => x.id === mid); if (!m) return; m.unread = false; res = m })
  return res
}
export async function markAllRead(o: string): Promise<void> { await mutate(o, b => { b.messages.forEach(m => m.unread = false) }) }

// ---- چت با صاحب آگهی ----
export async function listConversations(o: string): Promise<Conversation[]> {
  return [...(await getBuyer(o)).conversations].sort((a, b) => b.updatedAt - a.updatedAt)
}
export async function startConversation(o: string, input: { ownerName?: string; propertyTitle: string; text: string }): Promise<Conversation> {
  let c!: Conversation
  await mutate(o, b => {
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
export async function addChatMessage(o: string, convId: string, from: ChatFrom, text: string, ai = false): Promise<Conversation | null> {
  let res: Conversation | null = null
  await mutate(o, b => {
    const c = b.conversations.find(x => x.id === convId); if (!c) return
    c.messages.push({ id: id('cm_'), from, text, ai: ai || undefined, createdAt: Date.now() })
    c.updatedAt = Date.now(); res = c
  })
  return res
}
export async function getConversation(o: string, convId: string): Promise<Conversation | null> {
  return (await getBuyer(o)).conversations.find(c => c.id === convId) || null
}
// از روی صفحهٔ آگهی: گفتگوی همان ملک را پیدا یا ایجاد می‌کند (بدون پیامِ اولیه).
export async function upsertPropertyConversation(o: string, input: { propertyId: string; ownerName?: string; propertyTitle: string }): Promise<Conversation> {
  let c!: Conversation
  await mutate(o, b => {
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

// ---- دستیار هوشمند (AI) — چند گفتگوی جداگانه ----
export async function listAiChats(o: string): Promise<AiChat[]> {
  return [...(await getBuyer(o)).aiChats].sort((a, b) => b.updatedAt - a.updatedAt)
}
export async function getAiChat(o: string, chatId: string): Promise<AiChat | null> {
  return (await getBuyer(o)).aiChats.find(c => c.id === chatId) || null
}
export async function newAiChat(o: string): Promise<AiChat> {
  let c!: AiChat
  await mutate(o, b => { const now = Date.now(); c = { id: id('ac_'), title: 'گفتگوی جدید', messages: [], createdAt: now, updatedAt: now }; b.aiChats.unshift(c) })
  return c
}
// پیام را به گفتگو اضافه می‌کند؛ اگر chatId نبود، گفتگوی جدید می‌سازد.
export async function addAiChatMessage(o: string, chatId: string | undefined, role: AiRole, text: string): Promise<AiChat> {
  let res!: AiChat
  await mutate(o, b => {
    let c = chatId ? b.aiChats.find(x => x.id === chatId) : undefined
    if (!c) { const now = Date.now(); c = { id: id('ac_'), title: 'گفتگوی جدید', messages: [], createdAt: now, updatedAt: now }; b.aiChats.unshift(c) }
    c.messages.push({ id: id('ai_'), role, text, createdAt: Date.now() })
    if (role === 'user' && (c.title === 'گفتگوی جدید' || !c.title)) c.title = text.trim().slice(0, 40) || 'گفتگوی جدید'
    c.updatedAt = Date.now()
    res = c
  })
  return res
}
export async function renameAiChat(o: string, chatId: string, title: string): Promise<AiChat | null> {
  let res: AiChat | null = null
  await mutate(o, b => { const c = b.aiChats.find(x => x.id === chatId); if (!c) return; c.title = String(title).trim().slice(0, 60) || c.title; res = c })
  return res
}
export async function deleteAiChat(o: string, chatId: string): Promise<void> { await mutate(o, b => { b.aiChats = b.aiChats.filter(c => c.id !== chatId) }) }

export async function listSaved(o: string): Promise<SavedProperty[]> { return (await getBuyer(o)).saved }
export async function listSearches(o: string): Promise<SavedSearch[]> { return (await getBuyer(o)).searches }
export async function listViewings(o: string): Promise<BViewing[]> { return (await getBuyer(o)).viewings }
export async function listOffers(o: string): Promise<BOffer[]> { return (await getBuyer(o)).offers }
export async function listMessages(o: string): Promise<BMessage[]> { return (await getBuyer(o)).messages }
export async function updateBuyerProfile(o: string, patch: Partial<BuyerProfile>): Promise<BuyerProfile> {
  // verifyStatus از این مسیر تغییر نمی‌کند (فقط با requestVerification)
  const clean = { ...patch }; delete (clean as { verifyStatus?: unknown }).verifyStatus
  return (await mutate(o, b => { Object.assign(b.profile, clean) })).profile
}
export async function getBuyerSettings(o: string): Promise<BuyerSettings> { return (await getBuyer(o)).settings }
export async function updateBuyerSettings(o: string, patch: Partial<BuyerSettings>): Promise<BuyerSettings> {
  return (await mutate(o, b => { Object.assign(b.settings, patch) })).settings
}
export async function requestVerification(o: string): Promise<VerifyStatus> {
  let res: VerifyStatus = 'pending'
  await mutate(o, b => { if (b.profile.verifyStatus !== 'verified') b.profile.verifyStatus = 'pending'; res = b.profile.verifyStatus || 'pending' })
  return res
}
