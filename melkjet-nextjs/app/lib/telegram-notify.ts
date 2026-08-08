// فاز ۲۵۳ب — تطبیقِ آگهیِ نو با آلارم‌ها و ارسالِ کارت. از هوکِ تأییدِ ممیزی صدا زده می‌شود.
import { tgApi } from './telegram'
import { allSubs, type Sub } from './telegram-store'
import { listItems, type Item } from './scraper-store'

// نرمال‌سازیِ بخشندهٔ فارسی: الف/ی/ک یکی، نیم‌فاصله/فاصله/علائم حذف.
const norm = (s: string) => (s || '')
  .replace(/[‌\s]/g, '')
  .replace(/[أإآا]/g, 'ا')
  .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه').replace(/ۀ/g, 'ه')
  .replace(/[^؀-ۿ0-9a-zA-Z]/g, '')
  .trim()

/** تطبیق: نوع‌معامله + شهر + منطقه/محله (به‌صورتِ کلیدواژه در همهٔ فیلدهای مکانی).
 * فاز ۲۶۳ — قبلاً «منطقه» تطبیقِ دقیقِ meta['منطقه'] می‌خواست؛ ولی آگهیِ کاربر «منطقه» ندارد
 * (فقط شهر/محله/عنوان/موقعیت) → هر آلارمِ منطقه‌دار هیچ‌وقت match نمی‌شد. حالا منطقه و محله هر دو
 * به‌صورتِ جست‌وجو در منطقه+محله+عنوان+موقعیت بررسی می‌شوند (بخشنده و درست). */
export function matchSub(sub: Sub, it: Item): boolean {
  const m = (it.meta || {}) as Record<string, string>
  const deal = String(m['نوع معامله'] || '')
  const city = String(m['شهر'] || '')
  if (sub.deal && sub.deal !== 'همه' && deal && !deal.includes(sub.deal)) return false
  if (sub.city && norm(city) && !norm(city).includes(norm(sub.city)) && norm(city) !== norm(sub.city)) return false
  const hay = norm(`${m['منطقه'] || ''} ${m['محله'] || ''} ${it.location || ''} ${it.title || ''}`)
  // فاز ۲۶۷ — «محله» دقیق‌ترین معیار است و ملاکِ اصلی: اگر آلارم محله دارد، فقط محله سنجیده می‌شود.
  // «منطقه» را کاربر در ثبتِ آگهی وارد نمی‌کند (فقط شهر→محله)، پس نباید مانعِ تطبیق شود؛ منطقه
  // فقط وقتی به کار می‌رود که آلارم اصلاً محله نداشته باشد (آلارمِ کلِ یک منطقه).
  if (sub.hood) return hay.includes(norm(sub.hood))
  if (sub.region) return hay.includes(norm(sub.region))
  return true
}

function caption(it: Item): string {
  const m = (it.meta || {}) as Record<string, string>
  return [
    `🏠 <b>${it.title || 'آگهی جدید'}</b>`,
    it.price ? `💰 ${it.price}` : '',
    it.location ? `📍 ${it.location}` : '',
    m['متراژ'] ? `📐 ${m['متراژ']}` : '',
    m['نوع معامله'] ? `🔖 ${m['نوع معامله']}` : '',
  ].filter(Boolean).join('\n')
}

async function sendCard(chatId: number, it: Item) {
  const url = `https://melkjet.com/property/${it.id}`
  const reply_markup = { inline_keyboard: [[{ text: '👁 مشاهده در ملک‌جت', url }]] }
  const text = caption(it)
  if (it.image) return tgApi('sendPhoto', { chat_id: chatId, photo: it.image, caption: text, parse_mode: 'HTML', reply_markup })
  return tgApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false, reply_markup })
}

// فاز ۲۵۵ — کانالِ آگهی‌ها. مقصد از env می‌آید (@username یا -100…). خالی = خاموش (no-op).
const CHANNEL = () => process.env.TELEGRAM_CHANNEL || ''

// هشتگِ دسته‌بندی از متادیتا: #اجاره #تهران #منطقه_۵ (فاصله‌ها → زیرخط، تلگرام هشتگِ فارسی را می‌پذیرد).
function hashtags(it: Item): string {
  const m = (it.meta || {}) as Record<string, string>
  const tag = (s?: string) => (s && s.trim() ? '#' + s.trim().replace(/\s+/g, '_') : '')
  return [tag(m['نوع معامله']), tag(m['شهر']), tag(m['منطقه'])].filter(Boolean).join(' ')
}

/** پستِ خودکارِ آگهی‌های تازه در کانال (اگر تنظیم شده باشد). مستقل از آلارم‌ها. */
export async function postToChannel(items: Item[]) {
  const ch = CHANNEL()
  if (!ch) return
  let n = 0
  for (const it of items) {
    const url = `https://melkjet.com/property/${it.id}`
    const tags = hashtags(it)
    const text = caption(it) + (tags ? `\n\n${tags}` : '')
    const reply_markup = { inline_keyboard: [[{ text: '👁 مشاهده در ملک‌جت', url }]] }
    if (it.image) await tgApi('sendPhoto', { chat_id: ch, photo: it.image, caption: text, parse_mode: 'HTML', reply_markup })
    else await tgApi('sendMessage', { chat_id: ch, text, parse_mode: 'HTML', disable_web_page_preview: false, reply_markup })
    n++
    await new Promise(r => setTimeout(r, 60))
    if (n >= 100) break
  }
}

/** پستِ دستیِ آخرین آگهی‌ها در کانال (برای تست/سیدِ اولیه). تعدادِ پست‌شده را برمی‌گرداند. */
export async function seedChannel(limit = 5): Promise<number> {
  if (!CHANNEL()) return 0
  const items = (await listItems('listing', { publicOnly: true })).slice(0, limit)
  if (!items.length) return 0
  await postToChannel(items)
  return items.length
}

export async function notifyNewListings(items: Item[]) {
  const now = Date.now()
  const fresh = items.filter(it => it.type === 'listing' && (!it.scrapedAt || now - it.scrapedAt < 6 * 3600 * 1000))
  if (!fresh.length) return
  await postToChannel(fresh)               // فاز ۲۵۵ — پستِ کانال (مستقل از آلارم‌ها)
  const subs = await allSubs()
  if (!subs.length) return
  let sent = 0
  for (const it of fresh) {
    for (const sub of subs) {
      if (!matchSub(sub, it)) continue
      await sendCard(sub.chatId, it)
      sent++
      await new Promise(r => setTimeout(r, 45))
      if (sent >= 300) return
    }
  }
}

export async function sendTest(chatId: number): Promise<boolean> {
  const mine = (await allSubs()).filter(s => s.chatId === chatId)
  if (!mine.length) return false
  const items = await listItems('listing', { publicOnly: true })
  const hit = items.find(it => mine.some(s => matchSub(s, it)))
  if (!hit) return false
  await sendCard(chatId, hit)
  return true
}

function topBy(items: Item[], pick: (m: Record<string, string>) => string, filter: (m: Record<string, string>) => boolean, limit: number): string[] {
  const freq = new Map<string, number>()
  for (const it of items) {
    const m = (it.meta || {}) as Record<string, string>
    if (!filter(m)) continue
    const v = String(pick(m) || '').trim()
    if (v) freq.set(v, (freq.get(v) || 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([v]) => v)
}

/** مناطقِ یک شهر (پرتکرارتر اول). */
export async function regionsForCity(city: string, limit = 18): Promise<string[]> {
  const nc = norm(city)
  const items = await listItems('listing', { publicOnly: true })
  return topBy(items, m => m['منطقه'], m => { const c = norm(String(m['شهر'] || '')); return c === nc || c.includes(nc) }, limit)
}

/** محله‌های یک منطقه از یک شهر (پرتکرارتر اول). اگر region خالی بود، کلِ شهر. */
export async function hoodsForRegion(city: string, region: string, limit = 14): Promise<string[]> {
  const nc = norm(city), nr = norm(region)
  const items = await listItems('listing', { publicOnly: true })
  return topBy(items, m => m['محله'], m => {
    const c = norm(String(m['شهر'] || '')); if (c !== nc && !c.includes(nc)) return false
    if (nr && norm(String(m['منطقه'] || '')) !== nr) return false
    return true
  }, limit)
}
