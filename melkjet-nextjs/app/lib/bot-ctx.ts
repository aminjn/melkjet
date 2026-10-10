// فاز ۳۰۰ — بسترِ «چندسکوییِ» ربات: تلگرام + بله با یک هستهٔ مشترک.
// Bot APIِ بله سازگار با تلگرام است (tapi.bale.ai)، پس همان منطقِ گفت‌وگو برای هر دو کار می‌کند.
// با AsyncLocalStorage «سکوی جاری» را برای هر درخواست ست می‌کنیم؛ ترنسپورت (tgApi) و انبار
// (telegram-store) از همین می‌فهمند که الان تلگرام است یا بله — بدونِ تغییرِ منطقِ ۴۴۴خطیِ ربات.
import { AsyncLocalStorage } from 'node:async_hooks'
import { getAdminData } from './admin-store'
import { v2rayProxyUrl } from './v2ray'

export type BotPlatform = 'tg' | 'bale'
export interface BotCtx {
  platform: BotPlatform
  token: string
  apiBase: string    // مثلاً https://api.telegram.org/bot<token>
  fileBase: string   // مثلاً https://api.telegram.org/file/bot<token>
  proxy?: string     // تلگرام: پروکسی لازم دارد؛ بله: مستقیم (داخلی)
}

export const botALS = new AsyncLocalStorage<BotCtx>()
export function currentBot(): BotCtx | undefined { return botALS.getStore() }

// تلگرام از ایران فیلتر است → پروکسی (اول v2ray، بعد زنجیرهٔ قبلی). همان منطقِ فاز ۲۹۹.
export function tgBotCtx(): BotCtx {
  const token = process.env.TELEGRAM_BOT_TOKEN || ''
  const proxy =
    process.env.TELEGRAM_PROXY ||
    v2rayProxyUrl() ||
    getAdminData().divar?.proxyUrl ||
    process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.http_proxy ||
    'http://127.0.0.1:1080'
  return { platform: 'tg', token, apiBase: `https://api.telegram.org/bot${token}`, fileBase: `https://api.telegram.org/file/bot${token}`, proxy }
}

// بله داخلی است (فیلتر نیست) → اتصالِ مستقیم، بدونِ پروکسی/تونل.
export function baleBotCtx(): BotCtx {
  const token = getAdminData().bale?.token || process.env.BALE_BOT_TOKEN || ''
  return { platform: 'bale', token, apiBase: `https://tapi.bale.ai/bot${token}`, fileBase: `https://tapi.bale.ai/file/bot${token}`, proxy: '' }
}

export function botCtxFor(platform: BotPlatform): BotCtx { return platform === 'bale' ? baleBotCtx() : tgBotCtx() }
export const baleConfigured = () => !!(getAdminData().bale?.token || process.env.BALE_BOT_TOKEN)
export const baleEnabled = () => !!getAdminData().bale?.enabled && baleConfigured()
