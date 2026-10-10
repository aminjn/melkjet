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

/** پس از تأیید/ردِ آگهیِ کاربر توسطِ ادمین صدا زده می‌شود. prevStatus برای جلوگیری از خبرِ تکراری. */
export async function notifyListingDecision(item: Item | null | undefined, status: 'approved' | 'rejected', prevStatus?: string) {
  try {
    if (!item || item.type !== 'listing' || item.sourceId !== 'user') return   // فقط آگهیِ کاربرساخته
    if (prevStatus === status) return                                           // تغییرِ واقعیِ وضعیت
    const phone = norm(item.phone)
    const url = `https://melkjet.com/property/${item.id}`
    const title = (item.title || 'آگهیِ شما').slice(0, 80)
    if (status === 'approved') {
      const msg = `✅ آگهیِ شما در ملک‌جت تأیید و منتشر شد:\n${title}\n${url}`
      if (/^09\d{9}$/.test(phone)) sendServiceSms(phone, `آگهیِ شما در ملک‌جت تأیید و منتشر شد: ${url}`, 'تأیید آگهی', title, 'other').catch(() => {})
      await pingBots(phone, msg)
    } else {
      const msg = `❌ متأسفانه آگهیِ شما تأیید نشد:\n${title}\nمی‌توانی اصلاحش کنی و دوباره ثبت کنی.`
      await pingBots(phone, msg)
    }
  } catch (e) { console.warn('[notify] listing decision:', (e as Error).message) }
}
