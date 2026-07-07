// Empire · نامهٔ روزانهٔ ملک‌جت (سند فصل ۴ «AI Overnight» + فصل ۹ «Daily Loop») — فقط از دادهٔ واقعی.
// شب/سحرگاه (cron) برای هر امپراتوری یک نامه ساخته می‌شود: تغییرِ ارزشِ واقعیِ دارایی‌ها،
// آگهی‌های تازهٔ شهرِ کاربر، مأموریتِ قابلِ‌دریافت و استریکِ در خطر. صبح، کنجکاوی برمی‌گرداند.
import { getEmpire, listEmpireUsers, getBrief, saveBrief, dayNumberOf, netWorthOf } from './empire-store'
import { candidateListings, getItemById } from './scraper-store'
import { parseFaNum } from './reos/features'
import { getStreak } from './reos/achievements'
import { config, primeConfig } from './reos/reos-config'

const faB = (n: number) => n >= 1e9 ? `${(Math.round(n / 1e8) / 10).toLocaleString('fa-IR')} میلیارد` : `${Math.round(n / 1e6).toLocaleString('fa-IR')} میلیون`

// تولیدِ نامهٔ امروزِ یک کاربر (اگر از قبل نداشته باشد). خروجی: ساخته شد یا نه.
export async function buildBriefFor(userId: string, now = Date.now()): Promise<boolean> {
  const day = dayNumberOf(now)
  if (await getBrief(userId, day)) return false
  const e = await getEmpire(userId)
  if (!e) return false
  const items: Array<{ icon: string; text: string }> = []

  // ۱) ارزشِ زندهٔ دارایی‌ها از بازارِ واقعی (قولِ تعلیقِ دیشب: «فردا ساعت ۹ دوباره محاسبه می‌شود»)
  const prices: Record<string, number> = {}
  for (const a of e.assets) {
    const it = await getItemById(a.listingId).catch(() => null)
    const p = it ? parseFaNum(it.price) : 0
    if (p > 0) prices[a.listingId] = p
  }
  if (e.assets.length) {
    const nw = netWorthOf(e, prices)
    items.push({ icon: nw.growth > 0 ? '📈' : nw.growth < 0 ? '📉' : '📊', text: nw.growth ? `ارزشِ دارایی‌هایت نسبت به قیمتِ خرید ${Math.abs(nw.growth).toLocaleString('fa-IR')}٪ ${nw.growth > 0 ? 'بالاتر' : 'پایین‌تر'} است (${faB(nw.assetsValue)} تومان).` : `ارزشِ دارایی‌هایت روی ${faB(nw.assetsValue)} تومان پایدار است.` })
  }

  // ۲) گزارشِ صبحگاهیِ بازار (GDD جلد۸ «Morning Empire Report»): آگهی‌های تازهٔ شهر + داغ‌ترین محلهٔ امروز.
  const city = e.answers.city
  const all = await candidateListings(300).catch(() => [])
  if (city) {
    const fresh = all.filter(it => (it.location || '').includes(city) && (now - (it.scrapedAt || 0)) < 864e5)
    if (fresh.length) items.push({ icon: '🏙', text: `${fresh.length.toLocaleString('fa-IR')} آگهیِ تازه در ${city} ثبت شده — شاید فرصتِ بعدی‌ات بینشان باشد.` })
  }
  // داغ‌ترین محله = بیشترین آگهیِ تازهٔ ۴۸ ساعت (عرضهٔ واقعیِ بازار)
  const hotCount = new Map<string, number>()
  for (const it of all) {
    if ((now - (it.scrapedAt || 0)) > 2 * 864e5) continue
    const p = String(it.location || '').split(/[،,]/).map(x => x.trim()).filter(Boolean)
    const h = p.length > 1 ? p[p.length - 1] : (p[0] || '')
    if (h) hotCount.set(h, (hotCount.get(h) || 0) + 1)
  }
  const hot = [...hotCount.entries()].sort((a, b) => b[1] - a[1])[0]
  if (hot && hot[1] >= 3) items.push({ icon: '🔥', text: `بازارِ داغِ امروز: «${hot[0]}» با ${hot[1].toLocaleString('fa-IR')} آگهیِ تازه — زودتر از بقیه ببینش.` })

  // ۳) مأموریت/پاداشِ معطل (فصل ۹: «یک هدف در روز»)
  if (!e.claims['m1_explore']) items.push({ icon: '🎯', text: 'مأموریتِ «شهرت را کشف کن» هنوز باز است — امروز فقط چند آگهی ببین.' })
  else if (!e.claims['property_hunter']) items.push({ icon: '🕵️', text: 'مقایسهٔ «کدام بهتر است؟» منتظرِ توست — تحلیلِ درست پاداش دارد.' })

  // ۴) استریکِ در خطر (فصل ۹: «امروز فقط یک دقیقه وارد شو تا استریک حفظ شود»)
  try { const st = await getStreak(userId, now); if (st.atRisk && st.streak > 1) items.push({ icon: '🔥', text: `استریکِ ${st.streak.toLocaleString('fa-IR')}روزه‌ات در خطر است — همین ورودِ امروز نجاتش می‌دهد.` }) } catch {}

  if (!items.length) items.push({ icon: '🌱', text: 'بازار در حالِ حرکت است — امروز یک محلهٔ جدید را ببین تا ملک‌جت بهتر بشناسدت.' })
  await saveBrief({ userId, day, summary: items[0].text, items, priority: items.length })
  return true
}

// اجرای شبانه (cron): برای همهٔ امپراتوری‌ها نامهٔ امروز را می‌سازد. خروجی: تعدادِ ساخته‌شده.
export async function runEmpireBriefs(now = Date.now()): Promise<number> {
  await primeConfig()
  if (!config().empire.dailyBrief) return 0
  let made = 0
  for (const uid of await listEmpireUsers().catch(() => [] as string[])) {
    try { if (await buildBriefFor(uid, now)) made++ } catch { /* یک کاربرِ خراب، بقیه را متوقف نکند */ }
  }
  return made
}
