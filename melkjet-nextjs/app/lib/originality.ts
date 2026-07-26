// فاز ۲۲۶ (فیدبک: «این قسمتِ جعلی بودن واقعاً کار می‌کنه؟») — امتیازِ اصالتِ «واقعی و قطعی».
// قبلاً «اصیل تشخیص داده شد / احتمال جعلی کمتر از X٪» را خودِ AI از روی متنِ آگهی می‌ساخت —
// عددِ بی‌سند و ناقضِ قانونِ «هیچ دادهٔ فیک». حالا امتیاز فقط از سیگنال‌های واقعیِ ثبت‌شده
// محاسبه می‌شود، هر دلیلش شفاف به کاربر گفته می‌شود، و اگر داده کافی نباشد صادقانه
// «بررسیِ کافی ممکن نیست» می‌گوییم — هرگز «تضمین» و هرگز درصدِ ساختگی.

export interface OriginalitySignals {
  moderationApproved?: boolean   // ممیزیِ خودکار (شاملِ غربالِ تکراری) تأیید کرده؟ undefined = ممیزی نشده
  moderationScore?: number       // امتیازِ ممیزی ۰..۱۰۰ (aiScore)
  priceVsMarketPct?: number | null // درصدِ اختلافِ قیمتِ متری با میانهٔ محله؛ منفی = زیرِ بازار؛ null = نامعلوم
  hasGeo: boolean                // مختصاتِ واقعی دارد
  imageCount: number             // تعدادِ عکسِ واقعی (گالری/عکسِ اصلی)
  factsCount: number             // چند فیلدِ ساختاری (متراژ/طبقه/سال/اتاق) ثبت شده
  hasPhone: boolean              // شمارهٔ تماسِ ثبت‌شده دارد
  ownerAccount?: { exists: boolean; ageDays: number } | null // حسابِ ثبت‌کننده
}

export interface OriginalityVerdict {
  score: number                          // ۰..۱۰۰
  level: 'high' | 'medium' | 'low' | 'insufficient'
  reasons: string[]                      // دلایلِ واقعیِ مثبت/منفی — شفاف برای کاربر
  checked: number                        // چند سیگنالِ واقعی بررسی شد
}

export function originalityOf(s: OriginalitySignals): OriginalityVerdict {
  let score = 50
  const reasons: string[] = []
  let checked = 0
  let strong = 0   // سیگنال‌های قوی: ممیزی/قیمت‌نسبت‌به‌بازار/حسابِ ثبت‌کننده — بدونِ حداقل یکی، حکم نمی‌دهیم

  if (s.moderationApproved !== undefined) {
    checked++; strong++
    if (s.moderationApproved) { score += 15; reasons.push('ممیزیِ خودکار (شاملِ غربالِ آگهیِ تکراری) تأیید کرده') }
    else { score -= 25; reasons.push('ممیزیِ خودکار تأیید نکرده') }
    if (typeof s.moderationScore === 'number') score += Math.round((s.moderationScore - 50) / 10)  // ±۵
  }

  if (s.priceVsMarketPct != null) {
    checked++; strong++
    if (s.priceVsMarketPct <= -30) { score -= 25; reasons.push('قیمت به‌طرزِ غیرعادی پایین‌تر از بازارِ محله است — پیش از پرداخت حتماً حضوری بررسی کنید') }
    else if (s.priceVsMarketPct <= -15) { score -= 10; reasons.push('قیمت پایین‌تر از میانهٔ محله است') }
    else reasons.push('قیمت در محدودهٔ بازارِ محله است')
  }

  checked++
  if (s.imageCount >= 3) { score += 10; reasons.push(`${s.imageCount.toLocaleString('fa-IR')} عکسِ واقعی دارد`) }
  else if (s.imageCount >= 1) score += 4
  else { score -= 10; reasons.push('بدونِ عکس') }

  checked++
  if (s.hasGeo) { score += 8; reasons.push('موقعیتِ دقیق روی نقشه ثبت شده') }

  checked++
  if (s.factsCount >= 2) { score += 7; reasons.push('مشخصاتِ ساختاری (متراژ/طبقه/…) کامل است') }
  else if (s.factsCount === 0) score -= 6

  checked++
  if (s.hasPhone) score += 5
  else { score -= 8; reasons.push('شمارهٔ تماسِ ثبت‌شده ندارد') }

  if (s.ownerAccount) {
    checked++; strong++
    if (s.ownerAccount.exists && s.ownerAccount.ageDays >= 30) { score += 8; reasons.push('ثبت‌کننده حسابِ باسابقه در ملک‌جت دارد') }
    else if (s.ownerAccount.exists) { score += 3 }
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  let level: OriginalityVerdict['level'] = strong === 0 ? 'insufficient' : score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low'
  // سیگنالِ کلاسیکِ کلاهبرداری («قیمتِ خیلی زیرِ بازار») هرگز با مثبت‌های دیگر شسته نمی‌شود — سقف: متوسط
  if (level === 'high' && s.priceVsMarketPct != null && s.priceVsMarketPct <= -30) level = 'medium'
  return { score, level, reasons: reasons.slice(0, 5), checked }
}
