// فاز ۲۵۳ب — تطبیقِ آگهیِ نو با آلارم‌ها و ارسالِ کارت. از هوکِ تأییدِ ممیزی صدا زده می‌شود.
import { tgApi } from './telegram'
import { allSubs, type Sub } from './telegram-store'
import { botALS, botCtxFor, currentBot, type BotPlatform } from './bot-ctx'
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

// آدرسِ عکس برای تلگرام باید مطلق باشد. کشِ محلیِ تصویر، it.image را به «/api/li/…»
// تبدیل کرد و تلگرام آدرسِ نسبی را با «URL host is empty» رد می‌کند. نتیجه: از همان روز
// هیچ آگهیِ عکس‌داری به کانال نرفت و فقط صدها خطای بی‌صدا در لاگ نشست.
const tgPhoto = (im?: string): string =>
  !im ? '' : /^https?:\/\//i.test(im) ? im : im.startsWith('/') ? 'https://melkjet.com' + im : ''

async function sendCard(chatId: number, it: Item) {
  const url = `https://melkjet.com/property/${it.id}`
  const reply_markup = { inline_keyboard: [[{ text: '👁 مشاهده در ملک‌جت', url }]] }
  const text = caption(it)
  // اگر ارسالِ عکس نشد، پیامِ متنی می‌رود. پیش از این «عکس یا هیچ» بود: یک عکسِ خراب
  // یعنی آگهی کاملا گم می‌شد — بدترین شکلِ خرابی، چون هیچ‌کس متوجهش نمی‌شود.
  const ph = tgPhoto(it.image)
  if (ph) { const r = await tgApi('sendPhoto', { chat_id: chatId, photo: ph, caption: text, parse_mode: 'HTML', reply_markup }); if (r) return r }
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
    const ph = tgPhoto(it.image)
    const sent = ph ? await tgApi('sendPhoto', { chat_id: ch, photo: ph, caption: text, parse_mode: 'HTML', reply_markup }) : null
    if (!sent) await tgApi('sendMessage', { chat_id: ch, text, parse_mode: 'HTML', disable_web_page_preview: false, reply_markup })
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
  // «تازگی» تابعِ تاریخِ ثبتِ فایل است، نه تاریخِ آخرین نوشتن. scrapedAt در هر
  // به‌روزرسانی ریست می‌شود، پس آگهیِ سه‌ماهه‌ای که دوباره منتشر شود از این گارد
  // رد می‌شد و به‌عنوانِ «جدید» به کانال می‌رفت — ۲۹ اوت ۲۰۲۶، ترمیمِ انتشار.
  const fresh = items.filter(it => {
    if (it.type !== 'listing') return false
    const born = it.firstSeenAt || it.scrapedAt
    return !born || now - born < 6 * 3600 * 1000
  })
  if (!fresh.length) return
  await postToChannel(fresh)               // فاز ۲۵۵ — پستِ کانال (مستقل از آلارم‌ها)
  const subs = await allSubs()
  if (!subs.length) return
  let sent = 0
  for (const it of fresh) {
    for (const sub of subs) {
      if (!matchSub(sub, it)) continue
      // فاز ۳۰۰ — هر آلارم از ترنسپورتِ سکوی خودش می‌رود (تلگرام یا بله).
      await botALS.run(botCtxFor((sub.platform || 'tg') as BotPlatform), () => sendCard(sub.chatId, it))
      sent++
      await new Promise(r => setTimeout(r, 45))
      if (sent >= 300) return
    }
  }
}

export async function sendTest(chatId: number): Promise<boolean> {
  const plat = currentBot()?.platform || 'tg'
  const mine = (await allSubs()).filter(s => s.chatId === chatId && (s.platform || 'tg') === plat)
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
