// موتورِ اعتبار/گیمیفیکیشن — نشان‌ها از سیگنال‌های واقعی محاسبه می‌شوند، نه دستی.
// آستانه‌ها طوری‌اند که با «کامل‌ترشدنِ دیتا» خودبه‌خود فعال می‌شوند: تا وقتی دیتا کم
// است نشانی داده نمی‌شود؛ با رشدِ سابقه/آگهی/معامله/امتیاز، نشان‌ها خودکار ظاهر می‌شوند.
// این نشان‌ها جدا از «پروموتِ پولی» هستند (اعتبارِ اکتسابی، نه خریدنی).

export interface RepSignals {
  createdAt?: number       // زمانِ ساختِ حساب (سابقهٔ عضویت)
  rating?: number          // میانگینِ امتیازِ کاربران (۰ تا ۵)
  reviewCount?: number     // تعدادِ نظر (برای معناداریِ امتیاز)
  listingCount?: number    // تعدادِ آگهیِ منتشرشده
  soldCount?: number       // تعدادِ معاملهٔ موفق (فروخته/اجاره‌رفته)
  profileComplete?: boolean // پروفایلِ کامل (نام + عکس/لوگو + تماس)
  responsive?: boolean     // پاسخ‌گو (تماس در دسترس + فعالیتِ اخیر)
}

export interface RepBadge { id: string; label: string; icon: string; desc: string }

const DAY = 86400000

// نشان‌های اکتسابی از سیگنال‌ها. ترتیب = اولویتِ نمایش (مهم‌ترها اول).
export function computeRepBadges(s: RepSignals, now: number = Date.now()): RepBadge[] {
  const out: RepBadge[] = []
  if (s.profileComplete) out.push({ id: 'verified', label: 'تأییدشده', icon: '✓', desc: 'پروفایلِ کامل و اطلاعاتِ تماسِ تأییدشده' })
  if ((s.soldCount || 0) >= 3) out.push({ id: 'dealmaker', label: 'پرمعامله', icon: '🤝', desc: `${(s.soldCount || 0).toLocaleString('fa-IR')} معاملهٔ موفق` })
  if ((s.rating || 0) >= 4.5 && (s.reviewCount || 0) >= 3) out.push({ id: 'top_rated', label: 'خوش‌نام', icon: '★', desc: 'امتیازِ کاربران ۴٫۵ به بالا' })
  if ((s.listingCount || 0) >= 5) out.push({ id: 'active', label: 'فعال', icon: '⚡', desc: `${(s.listingCount || 0).toLocaleString('fa-IR')} آگهیِ فعال` })
  if (s.createdAt && now - s.createdAt >= 180 * DAY) out.push({ id: 'veteran', label: 'باسابقه', icon: '⏳', desc: 'بیش از ۶ ماه همراهیِ ملک‌جت' })
  if (s.responsive) out.push({ id: 'responsive', label: 'پاسخ‌گو', icon: '⚡', desc: 'در دسترس و پاسخ‌گویِ سریع' })
  // «فعال» و «پاسخ‌گو» هر دو ⚡ دارند؛ اگر هر دو بودند، پاسخ‌گو را حذف کن تا تکراری نباشد.
  const hasActive = out.some(b => b.id === 'active')
  return (hasActive ? out.filter(b => b.id !== 'responsive') : out)
}
