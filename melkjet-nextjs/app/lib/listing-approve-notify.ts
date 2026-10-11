// فاز ۳۰۰ج — خبرِ «نتیجهٔ بررسیِ آگهی» به صاحبِ آگهیِ کاربرساخته: پیامک + پیامِ ربات (تلگرام/بله).
// فقط برای آگهی‌های «ثبت توسطِ کاربر» (sourceId==='user') و وقتی شماره دارد — نه آگهی‌های اسکرپی.
import type { Item } from './scraper-store'
import { sendServiceSms } from './sms'
import { linksByPhone } from './telegram-store'
import { botALS, botCtxFor, type BotPlatform } from './bot-ctx'
import { tgSend } from './telegram'
import { FA_DIGITS, faDigit } from './digits'

const norm = (p?: string) => String(p || '').replace(FA_DIGITS, faDigit).replace(/\D/g, '')

async function pingBots(phone: string, text: string) {
  const links = await linksByPhone(phone)
  for (const l of links) {
    try { await botALS.run(botCtxFor((l.platform || 'tg') as BotPlatform), () => tgSend(l.chatId, text)) } catch {}
  }
}

/** پس از تأیید/ردِ آگهیِ کاربر صدا زده می‌شود. prevStatus از خبرِ تکراری جلوگیری می‌کند.
 *  opts.sms/opts.bot: برای تأییدِ خودکار (در خودِ ربات) فقط پیامک می‌رود چون ربات پیامِ درون‌خطی می‌دهد. */
export async function notifyListingDecision(
  item: Item | null | undefined,
  status: 'approved' | 'rejected',
  prevStatus?: string,
  opts?: { sms?: boolean; bot?: boolean },
) {
  try {
    if (!item || item.type !== 'listing' || item.sourceId !== 'user') return   // فقط آگهیِ کاربرساخته
    if (prevStatus === status) return                                           // تغییرِ واقعیِ وضعیت
    const sms = opts?.sms !== false, bot = opts?.bot !== false
    const phone = norm(item.phone)
    const url = `https://melkjet.com/property/${item.id}`
    const title = (item.title || 'آگهیِ شما').slice(0, 80)
    if (status === 'approved') {
      if (sms && /^09\d{9}$/.test(phone)) sendServiceSms(phone, `آگهیِ شما در ملک‌جت تأیید و منتشر شد: ${url}`, 'تأیید آگهی', title, 'other').catch(() => {})
      if (bot) await pingBots(phone, `✅ آگهیِ شما در ملک‌جت تأیید و منتشر شد:\n${title}\n${url}`)
    } else {
      if (bot) await pingBots(phone, `❌ متأسفانه آگهیِ شما تأیید نشد:\n${title}\nمی‌توانی اصلاحش کنی و دوباره ثبت کنی.`)
    }
  } catch (e) { console.warn('[notify] listing decision:', (e as Error).message) }
}
