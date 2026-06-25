import { listAll, setLastCheck, type SavedSearch } from './saved-search-store'
import { listItems } from './scraper-store'
import { getAccount } from './account-store'
import { pushSystemMessage } from './message-store'
import { getAdminData } from './admin-store'
import { shecanRequest } from './shecan-https'
import { PROPERTY_KINDS } from './taxonomy'
import { listForPhone, removeByEndpoint } from './push-store'
import { sendPush } from './web-push'

const norm = (s: string) => (s || '').replace(/‌/g, '').replace(/\s/g, '').toLowerCase()
const toLatin = (s: string) => (s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))

function itemDeal(it: any): 'sale' | 'rent' | 'presale' {
  const txt = `${it.price || ''} ${it.title || ''} ${it.category || ''} ${it.meta?.['نوع معامله'] || ''} ${(it.tags || []).join(' ')}`
  if (/پیش[‌\s]?فروش/.test(txt)) return 'presale'
  if (it.meta?.['نوع معامله'] === 'اجاره' || /اجاره|رهن|ودیعه/.test(txt)) return 'rent'
  return 'sale'
}
function priceB(it: any): number {
  const raw = parseFloat(toLatin(String(it.price || '')).replace(/[^\d.]/g, '')) || 0
  const t = it.price || ''
  return /میلیارد/.test(t) ? raw : /میلیون/.test(t) ? raw / 1000 : raw / 1e9
}
function itemKind(it: any): string {
  const t = `${it.title || ''} ${it.category || ''}`
  for (const k of PROPERTY_KINDS) for (const seg of k.split('/')) if (seg && t.includes(seg)) return k
  return ''
}

function matches(s: SavedSearch, it: any): boolean {
  if (itemDeal(it) !== s.deal) return false
  const loc = norm(it.location || '')
  if (s.city && !loc.includes(norm(s.city))) return false
  if (s.area && !loc.includes(norm(s.area))) return false
  if (s.kind) { const k = itemKind(it); if (k && k !== s.kind) return false }
  if (s.priceMax) { const p = priceB(it); if (p > 0 && p > s.priceMax) return false }
  return true
}

async function sendSms(phone: string, label: string) {
  const admin = getAdminData()
  if (!admin.alerts?.enabled) return
  const apiKey = process.env.IPPANEL_API_KEY || admin.ippanel?.apiKey
  const sender = process.env.IPPANEL_SENDER || admin.ippanel?.sender
  if (!apiKey || !sender) return
  const recipient = String(phone).replace(/\D/g, '')
  if (!/^09\d{9}$/.test(recipient)) return
  const text = `آگهیِ جدید مطابقِ جستجوی شما${label ? ` در ${label}` : ''} در ملک‌جت اضافه شد. برای دیدن وارد گفتگوها شوید.`
  const patternCode = (admin.alerts.pattern || '').trim()
  const patternVar = (admin.alerts.patternVar || 'message').trim() || 'message'
  try {
    let url: string, body: any
    if (patternCode) { url = 'https://api2.ippanel.com/api/v1/sms/pattern/normal/send'; body = { code: patternCode, sender, recipient, variable: { [patternVar]: label || 'ملک‌جت' } } }
    else { url = 'https://api2.ippanel.com/api/v1/sms/send/webservice/single'; body = { sender, recipient: [recipient], message: text, description: { summary: 'هشدار آگهی ملک‌جت', count_recipient: '1' } } }
    await shecanRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: apiKey, accept: 'application/json' }, body: JSON.stringify(body), timeout: 20000 })
  } catch { /* بی‌صدا */ }
}

// چرخهٔ هشدار: برای هر جستجوی ذخیره‌شده، آگهی‌های جدیدِ منطبق را پیدا و کاربر را مطلع می‌کند.
export async function processSavedSearches(now = Date.now()): Promise<{ searches: number; notified: number }> {
  const searches = listAll()
  if (!searches.length) return { searches: 0, notified: 0 }
  const items = listItems('listing', { publicOnly: true })   // مرتب بر اساسِ scrapedAt نزولی
  let notified = 0
  for (const s of searches) {
    const fresh: any[] = []
    for (const it of items) {
      if (it.scrapedAt <= s.lastCheck) break   // چون نزولی است، بقیه قدیمی‌ترند
      if (matches(s, it)) fresh.push(it)
      if (fresh.length >= 10) break
    }
    if (fresh.length) {
      const name = getAccount(s.owner)?.name || 'کاربر'
      for (const it of fresh.slice(0, 5)) {
        const txt = `🏠 آگهیِ جدید مطابقِ جستجوی شما${s.label ? ` (${s.label})` : ''}:\n«${it.title}»\n${it.price ? it.price + ' تومان\n' : ''}مشاهده: melkjet.com/property/${it.id}`
        try { pushSystemMessage(s.owner, name, txt) } catch {}
      }
      await sendSms(s.owner, s.label)
      // پوش‌نوتیفیکیشن (حتی اگر اپ بسته باشد)
      const top = fresh[0]
      const subs = listForPhone(s.owner)
      for (const sub of subs) {
        try {
          const st = await sendPush(sub, { title: 'آگهیِ جدید در ملک‌جت 🏠', body: `«${top.title}»${s.label ? ` در ${s.label}` : ''} مطابقِ جستجوی شما اضافه شد`, url: `/property/${top.id}`, tag: 'mj-alert' })
          if (st === 404 || st === 410) removeByEndpoint(sub.endpoint)
        } catch { /* بی‌صدا */ }
      }
      notified++
    }
    setLastCheck(s.id, now)
  }
  return { searches: searches.length, notified }
}
