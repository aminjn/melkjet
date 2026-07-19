// 🤝 فاز ۱۸۱ — فروش با چانه‌زنی از طریقِ مشاور: ملک را با «قیمتِ پیشنهادیِ» خودت به مشاور می‌سپاری؛
// هر بازه (knob، پیش‌فرض ۱ ساعت) یک پیشنهادِ خریدِ «قطعی از هش» حولِ ارزشِ واقعیِ روزِ ملک می‌آید.
// قبول می‌کنی، چانه می‌زنی (ریسکِ رفتنِ خریدار)، یا صبر می‌کنی — دلیلِ برگشتنِ هر ساعت، خارج از مأموریت.
// هیچ عددِ ساختگی: لنگرِ پیشنهاد = قیمتِ زندهٔ آگهیِ واقعی؛ باند/ریسک/بوست همه knob؛ هش = همان الگوی قطعیِ بازی.

export interface SellNegoCfg {
  enabled: boolean
  offerHours: number        // بازهٔ آمدنِ پیشنهادِ تازه (ساعت)
  bandLowPct: number        // کفِ پیشنهاد (٪ ارزشِ روز)
  bandHighPct: number       // سقفِ پیشنهاد (٪ ارزشِ روز)
  noOfferOverPct: number    // اگر قیمتِ پیشنهادیِ فروشنده بیش از این ٪ بالای بازار باشد، بعضی بازه‌ها خریدار نمی‌آید
  counterBoostPct: number   // حداکثر بوستِ چانه (٪)
  counterFailPct: number    // احتمالِ رفتنِ خریدار با چانه (٪)
}

function h32(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export const sellSlotOf = (now: number, offerHours: number) => Math.floor(now / (Math.max(1, offerHours) * 3600e3))

// پیشنهادِ این بازه — ۰ یعنی «این بازه خریداری نیامد» (قیمت‌گذاریِ بالای بازار = خریدارِ کمتر؛ اقتصادِ صادقانه)
export function sellOfferOf(assetId: string, slot: number, market: number, asking: number, cfg: SellNegoCfg): number {
  if (!(market > 0)) return 0
  const h = h32(`${assetId}|sell|${slot}`)
  const low = Math.min(cfg.bandLowPct, cfg.bandHighPct), high = Math.max(cfg.bandLowPct, cfg.bandHighPct)
  const factor = low + (h % (high - low + 1))
  if (asking > 0 && asking > market * (1 + Math.max(0, cfg.noOfferOverPct) / 100) && (h >> 7) % 2 === 0) return 0
  const offer = Math.round(market * factor / 100)
  return asking > 0 ? Math.min(offer, asking) : offer
}

// نتیجهٔ چانه — قطعی برای همان بازه: یا خریدار می‌رود، یا تا boostPct بالا می‌آید (سقف: قیمتِ پیشنهادیِ فروشنده)
export function counterRollOf(assetId: string, slot: number, cfg: SellNegoCfg): { walk: boolean; boostPct: number } {
  const h = h32(`${assetId}|counter|${slot}`)
  if (h % 100 < Math.max(0, Math.min(95, cfg.counterFailPct))) return { walk: true, boostPct: 0 }
  return { walk: false, boostPct: 1 + (h >> 8) % Math.max(1, Math.floor(cfg.counterBoostPct)) }
}
