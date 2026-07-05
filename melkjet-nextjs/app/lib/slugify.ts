// ── ابزارِ مرکزیِ ساختِ Slug (انگلیسی، kebab-case) — زیرساختِ SEOِ ملک‌جت ──
// قانون: URL انگلیسی/کوچک/با «-»؛ همه‌چیزِ دیگر فارسی. ابتدا دیکشنریِ اصطلاحاتِ
// شناخته‌شده (دقیق)، سپس ترنسلیترِ حرف‌به‌حرفِ فینگلیش برای دُمِ بلند.

// نگاشتِ حرف‌به‌حرفِ فارسی/عربی → لاتین (فینگلیشِ استاندارد).
const CHAR: Record<string, string> = {
  'ا': 'a', 'آ': 'a', 'أ': 'a', 'إ': 'a', 'ئ': 'y', 'ء': '', 'ؤ': 'v', 'ة': 'h',
  'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
  'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'gh', 'ک': 'k',
  'ك': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'و': 'v', 'ه': 'h', 'ی': 'y', 'ي': 'y',
  'َ': 'a', 'ِ': 'e', 'ُ': 'o', 'ً': 'an', 'ٍ': 'en', 'ٌ': 'on', 'ّ': '', 'ْ': '',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '‌': ' ',   // نیم‌فاصله → فاصله
}

// دیکشنریِ اصطلاحاتِ کلیدی (دقیق‌تر از ترنسلیتر). کلید = متنِ فارسیِ نرمال‌شده.
const DICT: Record<string, string> = {
  // دسته‌های بلاگ
  'راهنمای خرید': 'rahnamaye-kharid', 'راهنمای اجاره': 'rahnamaye-ejare', 'تحلیل بازار': 'tahlil-bazar',
  'سرمایه گذاری': 'sarmayegozari', 'سرمایه‌گذاری': 'sarmayegozari', 'حقوقی': 'hoghoghi',
  'وام': 'vam', 'وام و تسهیلات': 'vam', 'معماری': 'memari', 'معماری و دکوراسیون': 'memari', 'اخبار': 'akhbar',
  // نوعِ معامله / ملک
  'خرید': 'buy', 'فروش': 'sale', 'اجاره': 'rent', 'رهن': 'mortgage', 'رهن کامل': 'full-mortgage',
  'پیش فروش': 'pre-sale', 'پیش‌فروش': 'pre-sale', 'آپارتمان': 'apartment', 'ویلا': 'villa', 'خانه': 'home',
  'زمین': 'land', 'مغازه': 'shop', 'اداری': 'office', 'دفتر': 'office', 'تجاری': 'commercial', 'کلنگی': 'old-build',
  'سرمایه': 'investment', 'لوکس': 'luxury',
  // استان‌ها / شهرهای بزرگ
  'تهران': 'tehran', 'مشهد': 'mashhad', 'شیراز': 'shiraz', 'اصفهان': 'isfahan', 'تبریز': 'tabriz',
  'کرج': 'karaj', 'قم': 'qom', 'اهواز': 'ahvaz', 'رشت': 'rasht', 'کرمان': 'kerman', 'یزد': 'yazd',
  'البرز': 'alborz', 'فارس': 'fars', 'خراسان رضوی': 'khorasan-razavi', 'گیلان': 'gilan', 'مازندران': 'mazandaran',
  // محله‌های شاخصِ تهران (نمونه — بقیه با ترنسلیتر)
  'سعادت آباد': 'saadat-abad', 'سعادت‌آباد': 'saadat-abad', 'پونک': 'poonak', 'اکباتان': 'ekbatan',
  'ونک': 'vanak', 'جردن': 'jordan', 'زعفرانیه': 'zaferaniyeh', 'نیاوران': 'niavaran', 'تجریش': 'tajrish',
  'فرمانیه': 'farmaniyeh', 'الهیه': 'elahiyeh', 'پاسداران': 'pasdaran', 'شهرک غرب': 'shahrak-gharb',
  'منطقه': 'district',
}

const normFa = (s: string) => String(s || '').trim().replace(/\s+/g, ' ')

// ترنسلیترِ حرف‌به‌حرف (وقتی دیکشنری پوشش ندهد).
function translit(text: string): string {
  let out = ''
  for (const ch of normFa(text)) out += (CHAR[ch] !== undefined ? CHAR[ch] : ch)
  return out
}

// نرمال‌سازیِ نهایی به kebab-case انگلیسی.
export function kebab(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '')          // اعرابِ باقی‌مانده
    .replace(/[^a-z0-9]+/g, '-')                     // هر غیرِ [a-z0-9] → «-»
    .replace(/-+/g, '-').replace(/^-|-$/g, '')       // ادغام + trim
    .slice(0, 70)
}

// ساختِ slug از یک متن (فارسی یا انگلیسی). دیکشنری → کلمه‌به‌کلمه → ترنسلیتر.
export function slugify(text: string): string {
  const t = normFa(text)
  if (!t) return ''
  if (/^[a-zA-Z0-9\s-]+$/.test(t)) return kebab(t)     // از قبل انگلیسی
  if (DICT[t]) return DICT[t]                           // تطبیقِ کاملِ اصطلاح
  // کلمه‌به‌کلمه: هر کلمه از دیکشنری یا ترنسلیتر.
  const parts = t.split(' ').map(w => DICT[w] || translit(w))
  const joined = kebab(parts.join('-'))
  return joined || kebab(translit(t))
}

// یکتاسازی زیرِ یک مجموعهٔ موجود (تصادم → «-2»، «-3»…).
export function uniqueSlug(base: string, taken: Set<string> | ((s: string) => boolean)): string {
  const has = typeof taken === 'function' ? taken : (s: string) => taken.has(s)
  const b = base || 'item'
  if (!has(b)) return b
  for (let i = 2; i < 9999; i++) { const c = `${b}-${i}`; if (!has(c)) return c }
  return `${b}-${Date.now().toString(36)}`
}
