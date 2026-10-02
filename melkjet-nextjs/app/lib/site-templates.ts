// ─── فاز ۲۹۷هـ — موتورِ قالبِ سایت‌ساز (مشترکِ کلاینت/سرور) ─────────────────────
// همهٔ قالب‌ها، پالت‌ها، پیش‌فرضِ بلوک‌ها، محتوای صنفی و «صفحاتِ کاملِ هر پروفایل» که
// سایت‌ساز (WebsiteBuilderTool) با آن سایتِ حرفه‌ای می‌سازد، اینجا زندگی می‌کنند تا
// سایت‌سازِ خودکار (auto-site) هم «دقیقاً همان» را بسازد — نه یک چیدمانِ موازیِ فقیرتر.
// (عیناً از WebsiteBuilderTool منتقل شده؛ ابزار همین‌ها را import می‌کند — یک منبعِ حقیقت.)

export interface Theme {
  primary: string
  secondary?: string
  bg?: string
  surface?: string
  text?: string
  heading?: string
  font?: string
}

export const DEFAULT_THEME: Theme = { primary: '#c9a84c', secondary: '#1a1510', bg: '#ffffff', surface: '#fbfaf8', text: '#4a4338', heading: '#15110b' }

// پالت‌های آمادهٔ کاملِ سایت — تا قالب‌ها واقعاً متفاوت دیده شوند و کاربر یک‌کلیک تمِ کامل بگذارد.
export const SITE_PALETTES: { name: string; t: Required<Omit<Theme, 'font'>> }[] = [
  { name: 'طلایی کلاسیک', t: { primary: '#c9a84c', secondary: '#1a1510', bg: '#ffffff', surface: '#faf8f3', text: '#4a4338', heading: '#15110b' } },
  { name: 'آبی حرفه‌ای', t: { primary: '#2563eb', secondary: '#0f1f3a', bg: '#ffffff', surface: '#f3f6fc', text: '#3f4654', heading: '#0f1b30' } },
  { name: 'سبز اعتماد', t: { primary: '#0f9d76', secondary: '#06302c', bg: '#ffffff', surface: '#f0faf6', text: '#3c4a45', heading: '#0c241d' } },
  { name: 'مشکی لوکس', t: { primary: '#d4af37', secondary: '#0c0c0e', bg: '#0f0f12', surface: '#17171c', text: '#c9c6c1', heading: '#ffffff' } },
  { name: 'بنفش سلطنتی', t: { primary: '#7c3aed', secondary: '#1e1033', bg: '#ffffff', surface: '#f6f3fd', text: '#443a55', heading: '#1c1230' } },
  { name: 'نارنجی گرم', t: { primary: '#ea580c', secondary: '#2a1505', bg: '#ffffff', surface: '#fdf5ef', text: '#4d4338', heading: '#26160a' } },
  { name: 'فیروزه‌ای', t: { primary: '#0891b2', secondary: '#0a2a33', bg: '#ffffff', surface: '#eef9fc', text: '#3a4a4e', heading: '#0c2229' } },
  { name: 'صورتی مدرن', t: { primary: '#db2777', secondary: '#2a0d1f', bg: '#ffffff', surface: '#fdf2f8', text: '#4d3a44', heading: '#2a0d1f' } },
  { name: 'سرمه‌ای شب', t: { primary: '#60a5fa', secondary: '#0b1220', bg: '#0d1424', surface: '#141d31', text: '#b9c2d4', heading: '#ffffff' } },
  { name: 'زمرد تیره', t: { primary: '#34d399', secondary: '#06231a', bg: '#0b1a15', surface: '#10241d', text: '#aebfb7', heading: '#ffffff' } },
  { name: 'قرمز شرابی', t: { primary: '#be123c', secondary: '#2a0810', bg: '#ffffff', surface: '#fdf2f4', text: '#4d3a3f', heading: '#26090f' } },
  { name: 'خاکستری شیک', t: { primary: '#475569', secondary: '#1e293b', bg: '#ffffff', surface: '#f4f6f8', text: '#475569', heading: '#1e293b' } },
]

// پالتِ هر قالب بر اساسِ شمارهٔ آن — تا قالب‌های یک پروفایل، هرکدام رنگِ متفاوت داشته باشند.
export function templatePalette(tpl: { id: string }): Required<Omit<Theme, 'font'>> {
  const m = /(\d+)\s*$/.exec(tpl.id)
  const n = m ? parseInt(m[1], 10) : 0
  return SITE_PALETTES[n % SITE_PALETTES.length].t
}

// ── Per-type defaults: a fresh block looks real out of the box ──────────────
export const BLOCK_DEFAULTS: Record<string, Record<string, any>> = {
  hero: {
    eyebrow: 'املاک و مستغلات',
    heading: 'بهترین ملک را با ما بیابید',
    subheading: 'مشاور املاک حرفه‌ای با بیش از ۱۰ سال تجربه',
    buttonText: 'مشاهده ملک‌ها',
    buttonLink: '#listings',
    align: 'center',
    bg: 'linear-gradient(140deg,#1a1510,#2d2215,#1a1510)',
    textColor: '#ffffff',
    image: '',
    images: [],
    overlay: 'dark',
    height: 'normal',
  },
  search: {
    heading: 'جستجوی ملک',
    placeholder: 'منطقه، شهر یا محله را وارد کنید...',
  },
  catalog: {
    heading: 'محصولات ما',
    count: 12,
  },
  pricelist: {
    heading: 'نرخِ روزِ محصولات',
  },
  listings: {
    heading: 'آگهی‌های من',
    source: 'mine',
    total: 9,
    perSlide: 3,
    showCategories: 'yes',
    count: 3,
  },
  searchlist: {
    heading: 'جستجوی آگهی‌ها',
    total: 60,
  },
  blog: {
    heading: 'وبلاگ و مقالات',
    source: 'mine',
    count: 3,
  },
  blogfull: {
    heading: 'وبلاگ',
    source: 'mine',
    sidebar: 'yes',
  },
  services: {
    heading: 'خدمات ما',
    perSlide: 3,
    items: [
      { icon: '◇', title: 'خرید ملک', desc: 'مشاوره تخصصی برای خرید بهترین ملک' },
      { icon: '⌂', title: 'اجاره', desc: 'گزینه‌های متنوع اجاره مسکونی و تجاری' },
      { icon: '◈', title: 'مشاوره', desc: 'مشاوره رایگان سرمایه‌گذاری ملکی' },
    ],
  },
  about: {
    heading: 'درباره ما',
    text: 'ما با سال‌ها تجربه در حوزه املاک، همراه شما در مسیر خرید، فروش و اجاره ملک هستیم. تیم حرفه‌ای ما با ارائه مشاوره تخصصی، بهترین گزینه‌ها را متناسب با نیاز شما پیشنهاد می‌دهد.',
    image: '',
  },
  team: {
    heading: 'مشاوران ما',
    subheading: 'تیمِ حرفه‌ایِ مشاورانِ ما در کنارِ شما',
    showSites: 'yes',   // نمایشِ لینکِ سایتِ شخصیِ هر مشاور زیرِ عکسش
    showPhone: 'yes',
  },
  stats: {
    items: [
      { value: '۵۰۰+', label: 'ملک فروخته' },
      { value: '۱۲', label: 'سال تجربه' },
      { value: '۲۰۰', label: 'مشتری راضی' },
      { value: '۹۸٪', label: 'رضایت' },
    ],
  },
  gallery: {
    heading: 'گالری تصاویر',
    images: [],
    total: 9,
    perSlide: 3,
  },
  testimonials: {
    heading: 'نظرات مشتریان',
    showReal: 'yes',
    allowSubmit: 'yes',
    // خالی — نظرِ ساختگی با نامِ جعلی روی سایتِ زندهٔ کاربر منتشر نمی‌شود؛ فقط نظرِ واقعی/واردشده.
    items: [],
  },
  cta: {
    heading: 'همین امروز با ما تماس بگیرید',
    subheading: 'کارشناسان ما آماده پاسخگویی هستند',
    buttonText: 'تماس با ما',
    buttonLink: '#contact',
    bg: 'linear-gradient(135deg,#2d2215,#1a1510)',
  },
  contact: {
    heading: 'فرم تماس',
    phone: '۰۲۱-۱۲۳۴۵۶۷۸',
    email: 'info@example.com',
    address: 'تهران، ایران',
  },
  footer: {
    brand: 'ملک‌جت',
    about: 'مشاور املاک حرفه‌ای؛ همراهِ شما در خرید، فروش و اجارهٔ ملک با مشاورهٔ تخصصی و فایل‌های به‌روز.',
    links: [
      { label: 'خانه', href: '#' },
      { label: 'آگهی‌ها', href: '#listings' },
      { label: 'درباره ما', href: '#about' },
      { label: 'تماس', href: '#contact' },
    ],
    phone: '۰۲۱-۱۲۳۴۵۶۷۸',
    email: 'info@example.com',
    address: 'تهران، خیابان ولیعصر',
    instagram: '',
    telegram: '',
    whatsapp: '',
    linkedin: '',
    copyright: '© ۱۴۰۴ — تمامی حقوق محفوظ است',
    // back-compat
    text: 'ملک‌جت',
  },
}

// متن هیروی متمایز برای اولین قالب هر پروفایل (تا قالب‌ها واقعاً فرق کنند)
export const PROFILE_HERO_COPY: Record<string, { heading: string; subheading: string; buttonText: string }> = {
  'مشاور': { heading: 'مشاور املاک مورد اعتماد شما', subheading: 'بیش از ۱۰ سال تجربه در خرید، فروش و اجاره ملک', buttonText: 'مشاهده فایل‌ها' },
  'آژانس': { heading: 'آژانس املاک پیشرو', subheading: 'تیمی حرفه‌ای برای تمام نیازهای ملکی شما', buttonText: 'خدمات ما' },
  'سازنده': { heading: 'پروژه‌های ساختمانی لوکس', subheading: 'ساخت و پیش‌فروش واحدهای مسکونی و تجاری', buttonText: 'مشاهده پروژه‌ها' },
  'فروشگاه': { heading: 'فروشگاه مصالح ساختمانی', subheading: 'بهترین کیفیت با مناسب‌ترین قیمت', buttonText: 'مشاهده محصولات' },
  'سرمایه‌گذار': { heading: 'سرمایه‌گذاری هوشمند در املاک', subheading: 'بازده تضمین‌شده با فرصت‌های منتخب', buttonText: 'فرصت‌های سرمایه‌گذاری' },
  'حقوقی': { heading: 'مشاوره حقوقی تخصصی املاک', subheading: 'وکالت و تنظیم قراردادهای ملکی', buttonText: 'دریافت مشاوره' },
  'معمار': { heading: 'طراحیِ فضای رؤیاییِ شما', subheading: 'طراحیِ داخلی، معماری و نظارت بر پروژه‌های مسکونی، اداری و تجاری', buttonText: 'مشاهدهٔ نمونه‌کارها' },
  'پیمانکار': { heading: 'اجرای حرفه‌ایِ پروژه‌های ساختمانی', subheading: 'از فونداسیون تا تحویلِ کلید، با کیفیت، تعهد و زمان‌بندیِ دقیق', buttonText: 'مشاهدهٔ پروژه‌ها' },
  'کارشناس': { heading: 'کارشناسیِ رسمی و ارزیابیِ دقیقِ املاک', subheading: 'ارزیابی، تفکیک، افراز و تعیینِ اجاره‌بها با گزارشِ رسمیِ دادگستری', buttonText: 'درخواستِ کارشناسی' },
  'دفتر حقوقی': { heading: 'وکالت و مشاورهٔ تخصصیِ دعاویِ ملکی', subheading: 'قرارداد، خلعِ ید، الزام به تنظیمِ سند و مطالباتِ مالی', buttonText: 'رزروِ مشاوره' },
  'بانک و بیمه': { heading: 'تسهیلاتِ ملکی و بیمهٔ مطمئن', subheading: 'وامِ مسکن، وامِ ساخت و انواعِ بیمه‌نامه با بهترین شرایط', buttonText: 'درخواستِ تسهیلات' },
  'دفترخانه': { heading: 'دفترِ اسنادِ رسمی؛ سریع و مطمئن', subheading: 'تنظیمِ سند، وکالت‌نامه، تعهدنامه و استعلام با کمترین معطلی', buttonText: 'رزروِ نوبت' },
  'عمومی': { heading: 'بهترین ملک را با ما بیابید', subheading: 'مشاور املاک حرفه‌ای با بیش از ۱۰ سال تجربه', buttonText: 'مشاهده ملک‌ها' },
}

// محتوایِ اختصاصیِ هر صنف (خدمات/درباره/آمار/گالری) — تا سایتِ هر پنل «پُر و مرتبط» باشد،
// نه با متنِ عمومیِ املاک. در loadTemplate روی بلوک‌های services/about/stats/gallery نشانده می‌شود.
export interface ProfilePreset { servicesHeading?: string; services?: { icon: string; title: string; desc: string }[]; about?: string; aboutHeading?: string; stats?: { value: string; label: string }[]; galleryHeading?: string; footerAbout?: string; seoTitle?: string; seoDesc?: string; eyebrow?: string }
export const PROFILE_PRESETS: Record<string, ProfilePreset> = {
  // فاز ۲۹۷و — شش صنفِ پایه (مشاور/آژانس/سازنده/فروشگاه/سرمایه‌گذار/حقوقی) preset نداشتند و
  // به پیش‌فرضِ عمومیِ «مشاور املاک» می‌افتادند — سایتِ «سازنده» متنِ خرید/فروش/اجاره می‌گرفت.
  'مشاور': {
    servicesHeading: 'خدماتِ مشاورهٔ املاک',
    services: [
      { icon: '◇', title: 'خرید ملک', desc: 'یافتنِ بهترین گزینهٔ خرید متناسب با بودجه و نیازِ شما' },
      { icon: '⌂', title: 'فروش ملک', desc: 'قیمت‌گذاریِ کارشناسی و فروشِ سریع با بیشترین بازده' },
      { icon: '⇄', title: 'رهن و اجاره', desc: 'فایل‌های متنوعِ مسکونی و تجاری برای رهن و اجاره' },
      { icon: '◈', title: 'مشاورهٔ سرمایه‌گذاری', desc: 'راهنماییِ تخصصی برای سرمایه‌گذاریِ مطمئنِ ملکی' },
      { icon: '◉', title: 'کارشناسیِ قیمت', desc: 'تحلیلِ قیمتِ منطقه و ارزش‌گذاریِ واقع‌بینانهٔ ملک' },
      { icon: '§', title: 'همراهی تا سند', desc: 'از بازدید و مذاکره تا قرارداد و انتقالِ سند کنارِ شماییم' },
    ],
    aboutHeading: 'دربارهٔ من',
    about: 'به‌عنوانِ مشاورِ املاک، با شناختِ دقیقِ محله‌ها و قیمت‌های روز، کنارِ شما هستم تا معاملهٔ ملکی‌تان مطمئن، شفاف و به‌صرفه انجام شود. صداقت و پیگیری، اصلِ کارِ من است.',
    stats: [{ value: '۳۵۰+', label: 'معاملهٔ موفق' }, { value: '۱۰', label: 'سال تجربه' }, { value: '۹۶٪', label: 'رضایتِ مشتری' }, { value: '۲۴ ساعته', label: 'پاسخگویی' }],
    galleryHeading: 'گزیدهٔ فایل‌ها و بازدیدها',
    footerAbout: 'مشاورِ املاک؛ خرید، فروش، رهن و اجاره با مشاورهٔ تخصصی و فایل‌های به‌روز.', seoTitle: 'مشاورِ املاک', eyebrow: 'مشاور املاک', seoDesc: 'خرید، فروش، رهن و اجارهٔ ملک با مشاورهٔ تخصصی، کارشناسیِ قیمت و همراهی تا پایِ سند.',
  },
  'آژانس': {
    servicesHeading: 'خدماتِ آژانس',
    services: [
      { icon: '◇', title: 'خرید و فروش', desc: 'پوششِ کاملِ معاملاتِ مسکونی، تجاری و اداری' },
      { icon: '⇄', title: 'رهن و اجاره', desc: 'بانکِ فایلِ به‌روز برای رهن و اجاره در همهٔ محله‌ها' },
      { icon: '☺', title: 'تیمِ مشاورانِ متخصص', desc: 'برای هر محله و هر نوع ملک، مشاورِ متخصصِ خودش' },
      { icon: '◉', title: 'کارشناسیِ قیمت', desc: 'ارزش‌گذاریِ دقیق بر پایهٔ معاملاتِ واقعیِ منطقه' },
      { icon: '§', title: 'تنظیمِ قرارداد', desc: 'قراردادِ مطمئن با رعایتِ کاملِ نکاتِ حقوقی' },
      { icon: '⌂', title: 'مدیریتِ املاک', desc: 'سپرده‌گذاریِ ملک و مدیریتِ اجاره برای مالکان' },
    ],
    aboutHeading: 'دربارهٔ آژانس',
    about: 'آژانسِ ما با تیمی از مشاورانِ متخصصِ محله، بانکِ فایلِ به‌روز و فرایندِ شفافِ معامله، تجربه‌ای مطمئن از خرید، فروش و اجاره برای شما می‌سازد. اعتمادِ شما سرمایهٔ ماست.',
    stats: [{ value: '۲٬۰۰۰+', label: 'معاملهٔ انجام‌شده' }, { value: '۱۵', label: 'سال فعالیت' }, { value: '۲۰+', label: 'مشاورِ متخصص' }, { value: '۹۷٪', label: 'رضایتِ مشتری' }],
    galleryHeading: 'دفتر و تیمِ ما',
    footerAbout: 'آژانسِ املاک؛ خرید، فروش، رهن و اجاره با تیمِ مشاورانِ متخصصِ محله.', seoTitle: 'آژانسِ املاک', eyebrow: 'آژانس املاک', seoDesc: 'خرید، فروش، رهن و اجارهٔ ملک با تیمِ مشاورانِ متخصص، بانکِ فایلِ به‌روز و قراردادِ مطمئن.',
  },
  'سازنده': {
    servicesHeading: 'خدماتِ ساخت‌وساز',
    services: [
      { icon: '◧', title: 'ساخت‌وساز', desc: 'ساختِ پروژه‌های مسکونی و تجاری با متریالِ درجه‌یک' },
      { icon: '⌂', title: 'پیش‌فروش', desc: 'پیش‌فروشِ واحدها با قیمتِ مناسب و تحویلِ زمان‌بندی‌شده' },
      { icon: '⇄', title: 'مشارکت در ساخت', desc: 'مشارکتِ شفاف و برد-برد با مالکانِ زمین و کلنگی' },
      { icon: '✎', title: 'طراحی و اجرا', desc: 'از طراحیِ نقشه و نما تا اجرایِ کامل، یک‌جا' },
      { icon: '⟲', title: 'بازسازی', desc: 'نوسازی و بازسازیِ ساختمان‌های قدیمی' },
      { icon: '⛨', title: 'تعهدِ تحویل', desc: 'تحویلِ به‌موقع با کیفیتِ مهندسی و ضمانتِ ساخت' },
    ],
    aboutHeading: 'دربارهٔ سازنده',
    about: 'سازندهٔ پروژه‌های مسکونی و تجاری؛ با طراحیِ اصولی، متریالِ باکیفیت و اجرایِ مهندسی، ساختمان‌هایی می‌سازیم که سال‌ها ارزشِ خود را حفظ می‌کنند. مشارکت در ساخت و پیش‌فروش با شرایطِ شفاف.',
    stats: [{ value: '۴۰+', label: 'پروژهٔ تحویل‌شده' }, { value: '۱۲۰ هزار', label: 'مترمربع ساخت' }, { value: '۱۸', label: 'سال سابقه' }, { value: '۱۰۰٪', label: 'تحویلِ به‌موقع' }],
    galleryHeading: 'پروژه‌های ما',
    footerAbout: 'سازندهٔ ساختمان؛ ساخت، پیش‌فروش و مشارکت در ساخت با کیفیتِ مهندسی.', seoTitle: 'سازندهٔ ساختمان', eyebrow: 'ساخت و ساز', seoDesc: 'ساختِ پروژه‌های مسکونی و تجاری، پیش‌فروشِ واحد و مشارکت در ساخت با تحویلِ به‌موقع.',
  },
  'فروشگاه': {
    servicesHeading: 'دسته‌های محصولات',
    services: [
      { icon: '🧱', title: 'مصالحِ پایه', desc: 'سیمان، گچ، آجر، بلوک و شن‌وماسه با قیمتِ روز' },
      { icon: '▤', title: 'کاشی و سرامیک', desc: 'انواعِ کاشی، سرامیک و سنگِ ساختمانی' },
      { icon: '⚡', title: 'تأسیسات و برق', desc: 'لوله، اتصالات، سیم و ملزوماتِ برقی' },
      { icon: '◱', title: 'درب و پنجره', desc: 'دربِ ضدسرقت، پنجرهٔ دوجداره و یراق‌آلات' },
      { icon: '❖', title: 'رنگ و ابزار', desc: 'رنگِ ساختمانی، ابزارِ کار و ملزوماتِ نقاشی' },
      { icon: '⇄', title: 'ارسالِ سریع', desc: 'تحویلِ به‌موقع در محلِ پروژه، خرده و عمده' },
    ],
    aboutHeading: 'دربارهٔ فروشگاه',
    about: 'فروشگاهِ مصالحِ ساختمانیِ ما با تأمینِ مستقیم از تولیدکننده، قیمتِ رقابتی و ارسالِ سریع به محلِ پروژه، همراهِ سازندگان و خانواده‌هاست. کیفیتِ کالا و تحویلِ به‌موقع، تعهدِ ماست.',
    stats: [{ value: '۵٬۰۰۰+', label: 'قلم کالا' }, { value: '۱۴', label: 'سال فعالیت' }, { value: '۲۴ ساعته', label: 'ارسالِ سریع' }, { value: '۹۵٪', label: 'رضایتِ خریداران' }],
    galleryHeading: 'نمونهٔ محصولات',
    footerAbout: 'فروشگاهِ مصالحِ ساختمانی؛ تأمینِ مستقیم، قیمتِ رقابتی و ارسالِ سریع.', seoTitle: 'فروشگاهِ مصالحِ ساختمانی', eyebrow: 'مصالح ساختمانی', seoDesc: 'خریدِ مصالحِ ساختمانی با قیمتِ روز، تأمینِ مستقیم از تولیدکننده و ارسالِ سریع به پروژه.',
  },
  'سرمایه‌گذار': {
    servicesHeading: 'خدماتِ سرمایه‌گذاری',
    services: [
      { icon: '◔', title: 'فرصت‌های منتخب', desc: 'شناساییِ ملک‌های با پتانسیلِ رشدِ بالا' },
      { icon: '◉', title: 'تحلیلِ بازار', desc: 'تحلیلِ قیمت و روندِ محله‌ها بر پایهٔ دادهٔ واقعی' },
      { icon: '⇄', title: 'خرید و فروشِ سرمایه‌ای', desc: 'ورود و خروجِ به‌موقع برای بیشترین بازده' },
      { icon: '◧', title: 'مشارکت در ساخت', desc: 'سرمایه‌گذاری در پروژه‌های ساختمانیِ مطمئن' },
      { icon: '§', title: 'بررسیِ حقوقی', desc: 'راستی‌آزماییِ سند و وضعیتِ حقوقی پیش از خرید' },
      { icon: '◈', title: 'مدیریتِ پرتفوی', desc: 'چیدمان و مدیریتِ سبدِ دارایی‌های ملکی' },
    ],
    aboutHeading: 'دربارهٔ ما',
    about: 'ما با تحلیلِ دادهٔ واقعیِ بازارِ ملک، فرصت‌های سرمایه‌گذاریِ کم‌ریسک و پُربازده را شناسایی می‌کنیم و از انتخاب تا خروج کنارِ سرمایه‌گذار می‌مانیم. تصمیمِ آگاهانه، سودِ پایدار می‌سازد.',
    stats: [{ value: '۱۲۰+', label: 'سرمایه‌گذاریِ موفق' }, { value: '۱۱', label: 'سال تجربه' }, { value: '۳۵٪', label: 'میانگینِ بازدهِ سالانه' }, { value: '۵۰+', label: 'سرمایه‌گذارِ همراه' }],
    galleryHeading: 'پروژه‌ها و فرصت‌ها',
    footerAbout: 'سرمایه‌گذاریِ ملکی؛ شناساییِ فرصت‌های پُربازده با تحلیلِ دادهٔ واقعیِ بازار.', seoTitle: 'سرمایه‌گذاریِ ملکی', eyebrow: 'سرمایه‌گذاری ملکی', seoDesc: 'فرصت‌های سرمایه‌گذاریِ ملکیِ منتخب با تحلیلِ بازار، بررسیِ حقوقی و مدیریتِ پرتفوی.',
  },
  'حقوقی': {
    servicesHeading: 'خدماتِ حقوقیِ ملکی',
    services: [
      { icon: '§', title: 'دعاویِ ملکی', desc: 'خلعِ ید، تخلیه، الزام به تنظیمِ سند و ابطالِ معامله' },
      { icon: '✎', title: 'تنظیمِ قرارداد', desc: 'تنظیم و بازبینیِ مبایعه‌نامه، اجاره‌نامه و مشارکت' },
      { icon: '◉', title: 'بررسیِ سند', desc: 'راستی‌آزماییِ سند و استعلاماتِ ثبتی پیش از معامله' },
      { icon: '◈', title: 'مشاورهٔ پیش از معامله', desc: 'پیشگیری از اختلاف با مشاورهٔ حقوقیِ به‌موقع' },
      { icon: '⛨', title: 'داوری و سازش', desc: 'حلِ اختلافِ ملکی بدونِ فرسایشِ دادگاه' },
      { icon: '☖', title: 'امورِ ثبتی', desc: 'پیگیریِ سند، تفکیک و امورِ ادارهٔ ثبت' },
    ],
    aboutHeading: 'دربارهٔ ما',
    about: 'مشاورِ حقوقیِ تخصصیِ املاک؛ از بررسیِ سند و تنظیمِ قرارداد تا وکالت در دعاویِ ملکی، کنارِ شما هستیم تا معامله‌تان از روزِ اول محکم و بی‌اختلاف باشد.',
    stats: [{ value: '۸۰۰+', label: 'پروندهٔ ملکی' }, { value: '۱۵', label: 'سال تجربه' }, { value: '۹۲٪', label: 'نرخِ موفقیت' }, { value: '۲۴ ساعته', label: 'پاسخِ مشاوره' }],
    galleryHeading: 'مدارک و افتخارات',
    footerAbout: 'خدماتِ حقوقیِ املاک؛ قرارداد، دعاویِ ملکی و مشاورهٔ پیش از معامله.', seoTitle: 'مشاورهٔ حقوقیِ املاک', eyebrow: 'خدمات حقوقی', seoDesc: 'مشاورهٔ حقوقیِ ملکی، تنظیمِ قرارداد، بررسیِ سند و وکالت در دعاویِ ملکی.',
  },
  'معمار': {
    servicesHeading: 'خدماتِ طراحی و معماری',
    services: [
      { icon: '✎', title: 'طراحیِ داخلی', desc: 'طراحیِ دکوراسیونِ داخلیِ مسکونی، اداری و تجاری متناسب با سبکِ شما' },
      { icon: '◱', title: 'طراحیِ نما', desc: 'طراحیِ نمای مدرن و کلاسیک با متریالِ روز و اجرایِ دقیق' },
      { icon: '⟳', title: 'بازسازی', desc: 'بازسازیِ کاملِ فضاهای قدیمی با کمترین هزینه و بیشترین کیفیت' },
      { icon: '◈', title: 'نظارتِ اجرا', desc: 'نظارتِ تخصصی بر رونِد اجرا تا تحققِ کاملِ طرح' },
      { icon: '⬢', title: 'مدل‌سازیِ سه‌بعدی', desc: 'ارائهٔ پلان و رندرِ سه‌بعدی پیش از اجرا' },
      { icon: '☰', title: 'مشاورهٔ طراحی', desc: 'مشاورهٔ تخصصی برای انتخابِ سبک، نور و چیدمان' },
    ],
    aboutHeading: 'دربارهٔ استودیوِ ما',
    about: 'استودیوِ معماریِ ما با تلفیقِ زیبایی و کارایی، فضاهایی خلق می‌کند که هم چشم‌نواز و هم کاربردی‌اند. با تیمی از معماران و طراحانِ داخلیِ باتجربه، از ایده تا اجرا کنارِ شما هستیم.',
    stats: [{ value: '۲۵۰+', label: 'پروژهٔ طراحی' }, { value: '۱۴', label: 'سال تجربه' }, { value: '۹۸٪', label: 'رضایتِ کارفرما' }, { value: '۳', label: 'جایزهٔ طراحی' }],
    galleryHeading: 'نمونه‌کارها و پروژه‌ها',
    footerAbout: 'استودیوِ معماری و طراحیِ داخلی؛ خلقِ فضاهایی زیبا و کاربردی از ایده تا اجرا.', seoTitle: 'استودیوِ معماری و طراحیِ داخلی', eyebrow: 'معماری و طراحی', seoDesc: 'طراحیِ داخلی، معماری و نظارت بر پروژه‌های مسکونی، اداری و تجاری با تیمی حرفه‌ای.',
  },
  'پیمانکار': {
    servicesHeading: 'خدماتِ اجرایی',
    services: [
      { icon: '◧', title: 'ساخت از صفر', desc: 'اجرایِ کاملِ پروژه از فونداسیون تا تحویلِ کلید' },
      { icon: '⬒', title: 'اسکلت و سازه', desc: 'اجرایِ اسکلتِ فلزی و بتنی با استانداردِ مهندسی' },
      { icon: '▤', title: 'سفت‌کاری و نازک‌کاری', desc: 'دیوارچینی، گچ‌کاری، کاشی و سنگ با کیفیتِ بالا' },
      { icon: '⚡', title: 'تأسیساتِ مکانیکی و برقی', desc: 'اجرایِ کاملِ آب، فاضلاب، گرمایش و برق' },
      { icon: '⟲', title: 'بازسازی', desc: 'بازسازیِ ساختمان‌های فرسوده و به‌روزرسانیِ فضاها' },
      { icon: '❖', title: 'محوطه‌سازی', desc: 'اجرایِ محوطه، فضایِ سبز و نمای بیرونی' },
    ],
    aboutHeading: 'دربارهٔ شرکتِ ما',
    about: 'شرکتِ پیمانکاریِ ما با اکیپِ مجرب، ماشین‌آلاتِ مدرن و مدیریتِ دقیقِ پروژه، ساختمان‌هایی باکیفیت و در زمان‌بندیِ مشخص تحویل می‌دهد. تعهد، کیفیت و شفافیتِ مالی، اصولِ کارِ ماست.',
    stats: [{ value: '۱۸۰+', label: 'پروژهٔ اجراشده' }, { value: '۲۲۰ هزار', label: 'مترمربع ساخت' }, { value: '۱۶', label: 'سال سابقه' }, { value: '۱۰۰٪', label: 'تحویلِ به‌موقع' }],
    galleryHeading: 'پروژه‌های اجراشده',
    footerAbout: 'شرکتِ پیمانکاریِ ساختمان؛ اجرایِ حرفه‌ای از فونداسیون تا تحویلِ کلید.', seoTitle: 'شرکتِ پیمانکاریِ ساختمان', eyebrow: 'ساخت و ساز', seoDesc: 'اجرایِ حرفه‌ایِ پروژه‌های ساختمانی از فونداسیون تا تحویلِ کلید، با کیفیت و تعهد.',
  },
  'کارشناس': {
    servicesHeading: 'خدماتِ کارشناسی',
    services: [
      { icon: '◉', title: 'ارزیابیِ ملک', desc: 'تعیینِ ارزشِ روزِ ملک برای خرید، فروش، وثیقه و مالیات' },
      { icon: '⚠', title: 'ارزیابیِ خسارت', desc: 'برآوردِ خسارتِ ناشی از حریق، سیل و حوادث' },
      { icon: '⊞', title: 'تفکیک و افراز', desc: 'کارشناسیِ تفکیک، افراز و تقسیمِ املاکِ مشاع' },
      { icon: '⌂', title: 'تعیینِ اجاره‌بها', desc: 'تعیینِ اجاره‌بها و سرقفلیِ منصفانه' },
      { icon: '§', title: 'گزارشِ رسمی', desc: 'تنظیمِ گزارشِ کارشناسیِ رسمیِ موردِ قبولِ مراجع' },
      { icon: '☰', title: 'مشاورهٔ فنی', desc: 'مشاورهٔ فنی و حقوقی در معاملاتِ ملکی' },
    ],
    aboutHeading: 'دربارهٔ کارشناس',
    about: 'کارشناسِ رسمیِ دادگستری در رشتهٔ راه و ساختمان، با سال‌ها تجربه در ارزیابیِ دقیق و بی‌طرفانهٔ املاک. گزارش‌های ما موردِ استنادِ دادگاه‌ها، بانک‌ها و ادارات است.',
    stats: [{ value: '۹۰۰+', label: 'پروندهٔ کارشناسی' }, { value: '۲۰', label: 'سال سابقه' }, { value: '۹۹٪', label: 'دقتِ ارزیابی' }, { value: '۴۸ ساعت', label: 'زمانِ صدورِ گزارش' }],
    galleryHeading: 'نمونهٔ گزارش‌ها',
    footerAbout: 'کارشناسِ رسمیِ دادگستری؛ ارزیابیِ دقیق و بی‌طرفانهٔ املاک با گزارشِ رسمی.', seoTitle: 'کارشناسِ رسمیِ دادگستری — املاک', eyebrow: 'کارشناسِ رسمی', seoDesc: 'ارزیابی، تفکیک و تعیینِ اجاره‌بهای املاک با گزارشِ رسمیِ موردِ قبولِ مراجع.',
  },
  'دفتر حقوقی': {
    servicesHeading: 'خدماتِ حقوقی',
    services: [
      { icon: '§', title: 'دعاویِ ملکی', desc: 'خلعِ ید، تخلیه، الزام به تنظیمِ سند و ابطالِ معامله' },
      { icon: '✎', title: 'تنظیمِ قرارداد', desc: 'تنظیم و بازبینیِ انواعِ قراردادهای ملکی و تجاری' },
      { icon: '⚖', title: 'مطالباتِ مالی', desc: 'وصولِ مطالبات، چک و سفتهٔ برگشتی' },
      { icon: '◈', title: 'مشاورهٔ حقوقی', desc: 'مشاورهٔ تخصصی پیش از معامله برای پیشگیری از دعوا' },
      { icon: '☖', title: 'امورِ ثبتی', desc: 'پیگیریِ امورِ ثبتی، سند و استعلامات' },
      { icon: '⛨', title: 'داوری', desc: 'حلِ اختلافاتِ ملکی از طریقِ داوری و سازش' },
    ],
    aboutHeading: 'دربارهٔ دفترِ ما',
    about: 'دفترِ حقوقیِ ما با تیمی از وکلای پایه‌یکِ دادگستری، در تمامِ دعاوی و قراردادهای ملکی کنارِ شماست. هدفِ ما، احقاقِ حقِ موکل با کمترین زمان و هزینه است.',
    stats: [{ value: '۱٬۲۰۰+', label: 'پروندهٔ موفق' }, { value: '۱۸', label: 'سال تجربه' }, { value: '۹۴٪', label: 'نرخِ موفقیت' }, { value: '۵', label: 'وکیلِ پایه‌یک' }],
    galleryHeading: 'گواهی‌نامه‌ها و افتخارات',
    footerAbout: 'دفترِ حقوقیِ تخصصیِ املاک؛ وکالت، مشاوره و تنظیمِ قرارداد با وکلای پایه‌یک.', seoTitle: 'دفترِ حقوقیِ تخصصیِ املاک', eyebrow: 'خدماتِ حقوقی', seoDesc: 'وکالت و مشاورهٔ دعاویِ ملکی: قرارداد، خلعِ ید و الزام به تنظیمِ سند با وکلای پایه‌یک.',
  },
  'بانک و بیمه': {
    servicesHeading: 'خدماتِ مالی و بیمه‌ای',
    services: [
      { icon: '⌂', title: 'وامِ مسکن', desc: 'تسهیلاتِ خریدِ مسکن با نرخ و بازپرداختِ مناسب' },
      { icon: '◧', title: 'وامِ ساخت', desc: 'تأمینِ مالیِ پروژه‌های ساختمانی و انبوه‌سازی' },
      { icon: '🔥', title: 'بیمهٔ آتش‌سوزی', desc: 'پوششِ کاملِ ساختمان در برابرِ حریق، سیل و زلزله' },
      { icon: '♥', title: 'بیمهٔ عمر', desc: 'بیمهٔ عمر و سرمایه‌گذاری با سودِ تضمینی' },
      { icon: '⛨', title: 'بیمهٔ مسئولیت', desc: 'بیمهٔ مسئولیتِ مدنیِ سازندگان و کارفرمایان' },
      { icon: '◈', title: 'مشاورهٔ مالی', desc: 'مشاورهٔ تخصصی برای انتخابِ بهترین طرحِ تسهیلات و بیمه' },
    ],
    aboutHeading: 'دربارهٔ ما',
    about: 'ما با ارائهٔ راهکارهای مالی و بیمه‌ایِ متنوع، خریدِ ملک و اجرای پروژه را برای شما آسان می‌کنیم. کارشناسانِ ما بهترین طرح را متناسب با شرایطِ شما پیشنهاد می‌دهند.',
    stats: [{ value: '۵ هزار میلیارد', label: 'تسهیلاتِ پرداختی' }, { value: '۳۰ هزار', label: 'مشتری' }, { value: '۲۵', label: 'سال فعالیت' }, { value: '۹۶٪', label: 'رضایتِ مشتری' }],
    galleryHeading: 'طرح‌ها و تفاهم‌نامه‌ها',
    footerAbout: 'خدماتِ مالی و بیمه‌ایِ املاک؛ وامِ مسکن، وامِ ساخت و انواعِ بیمه‌نامه.', seoTitle: 'خدماتِ مالی و بیمهٔ املاک', eyebrow: 'مالی و بیمه', seoDesc: 'وامِ مسکن، وامِ ساخت و انواعِ بیمه‌نامه با بهترین شرایط و مشاورهٔ رایگان.',
  },
  'دفترخانه': {
    servicesHeading: 'خدماتِ ثبتی',
    services: [
      { icon: '§', title: 'تنظیمِ سند', desc: 'تنظیمِ سندِ رسمیِ نقل و انتقالِ املاک و خودرو' },
      { icon: '✎', title: 'وکالت‌نامه', desc: 'تنظیمِ انواعِ وکالت‌نامهٔ رسمی و بلاعزل' },
      { icon: '☖', title: 'تعهدنامه و اقرارنامه', desc: 'تنظیمِ تعهدنامه، اقرارنامه و رضایت‌نامه' },
      { icon: '◉', title: 'استعلامِ ثبتی', desc: 'اخذِ استعلامِ آنیِ وضعیتِ ثبتیِ ملک' },
      { icon: '⇄', title: 'نقل و انتقال', desc: 'انجامِ کاملِ مراحلِ نقل و انتقالِ سند' },
      { icon: '◈', title: 'مشاورهٔ اسناد', desc: 'مشاوره برای تنظیمِ درستِ اسناد و پیشگیری از مشکلات' },
    ],
    aboutHeading: 'دربارهٔ دفترخانه',
    about: 'دفترِ اسنادِ رسمیِ ما با کادری مجرب و سیستمِ نوبت‌دهیِ آنلاین، خدماتِ ثبتیِ شما را سریع، دقیق و مطمئن انجام می‌دهد. رضایتِ مراجعان، اولویتِ ماست.',
    stats: [{ value: '۴۰ هزار+', label: 'سندِ ثبت‌شده' }, { value: '۲۲', label: 'سال فعالیت' }, { value: '۱۵ دقیقه', label: 'میانگینِ انتظار' }, { value: '۹۷٪', label: 'رضایتِ مراجع' }],
    galleryHeading: 'دفتر و امکانات',
    footerAbout: 'دفترِ اسنادِ رسمی؛ تنظیمِ سند، وکالت و استعلام با نوبت‌دهیِ آنلاین.', seoTitle: 'دفترِ اسنادِ رسمی', eyebrow: 'اسنادِ رسمی', seoDesc: 'تنظیمِ سند، وکالت‌نامه، تعهدنامه و استعلامِ ثبتی سریع و مطمئن با نوبت‌دهیِ آنلاین.',
  },
}

export const STARTER_TEMPLATES = [
  // ───────── مشاور (۱۰) ─────────
  { id: 'pro-01', name: 'مشاور کلاسیک', profile: 'مشاور', blocks: ['hero', 'listings', 'testimonials', 'contact', 'footer'], desc: 'هیرو، فایل‌ها، نظرات، تماس' },
  { id: 'pro-02', name: 'مشاور مدرن', profile: 'مشاور', blocks: ['hero', 'stats', 'listings', 'about', 'footer'], desc: 'هیرو، آمار، فایل‌ها، درباره', blogPage: true },
  { id: 'pro-03', name: 'مشاور حرفه‌ای', profile: 'مشاور', blocks: ['hero', 'gallery', 'services', 'cta', 'contact', 'footer'], desc: 'هیرو، گالری، خدمات، اقدام، تماس' },
  { id: 'pro-04', name: 'مشاور لوکس', profile: 'مشاور', blocks: ['hero', 'about', 'listings', 'testimonials', 'cta', 'footer'], desc: 'هیرو، معرفی، فایل‌ها، نظرات' },
  { id: 'pro-05', name: 'مشاور جستجو‌محور', profile: 'مشاور', blocks: ['hero', 'search', 'listings', 'contact', 'footer'], desc: 'هیرو، جستجو، فایل‌ها، تماس' },
  { id: 'pro-06', name: 'مشاور کامل', profile: 'مشاور', blocks: ['hero', 'services', 'stats', 'listings', 'testimonials', 'footer'], desc: 'هیرو، خدمات، آمار، فایل‌ها، نظرات', blogPage: true },
  { id: 'pro-07', name: 'مشاور تک‌برگ', profile: 'مشاور', blocks: ['hero', 'listings', 'about', 'cta', 'footer'], desc: 'هیرو، فایل‌ها، درباره، اقدام' },
  { id: 'pro-08', name: 'مشاور تصویری', profile: 'مشاور', blocks: ['hero', 'gallery', 'listings', 'testimonials', 'contact', 'footer'], desc: 'هیرو، گالری، فایل‌ها، نظرات، تماس' },
  { id: 'pro-09', name: 'مشاور معتبر', profile: 'مشاور', blocks: ['hero', 'about', 'stats', 'services', 'contact', 'footer'], desc: 'هیرو، درباره، آمار، خدمات، تماس' },
  { id: 'pro-10', name: 'مشاور سریع', profile: 'مشاور', blocks: ['hero', 'search', 'services', 'testimonials', 'cta', 'footer'], desc: 'هیرو، جستجو، خدمات، نظرات، اقدام' },

  // ───────── آژانس (۱۰) ─────────
  { id: 'agc-01', name: 'آژانس جامع', profile: 'آژانس', blocks: ['hero', 'services', 'listings', 'team', 'contact', 'footer'], desc: 'هیرو، خدمات، فایل‌ها، تیم، تماس' },
  { id: 'agc-02', name: 'آژانس لوکس', profile: 'آژانس', blocks: ['hero', 'gallery', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، گالری، خدمات، نظرات' },
  { id: 'agc-03', name: 'آژانس مدرن', profile: 'آژانس', blocks: ['hero', 'search', 'listings', 'stats', 'cta', 'footer'], desc: 'هیرو، جستجو، فایل‌ها، آمار، اقدام' },
  { id: 'agc-04', name: 'آژانس حرفه‌ای', profile: 'آژانس', blocks: ['hero', 'about', 'services', 'stats', 'testimonials', 'footer'], desc: 'هیرو، درباره، خدمات، آمار، نظرات', blogPage: true },
  { id: 'agc-05', name: 'آژانس برتر', profile: 'آژانس', blocks: ['hero', 'stats', 'listings', 'testimonials', 'contact', 'footer'], desc: 'هیرو، آمار، فایل‌ها، نظرات، تماس' },
  { id: 'agc-06', name: 'آژانس تیمی', profile: 'آژانس', blocks: ['hero', 'team', 'gallery', 'services', 'contact', 'footer'], desc: 'هیرو، تیم، گالری، خدمات، تماس' },
  { id: 'agc-07', name: 'آژانس کامل', profile: 'آژانس', blocks: ['hero', 'search', 'services', 'listings', 'testimonials', 'footer'], desc: 'هیرو، جستجو، خدمات، فایل‌ها، نظرات' },
  { id: 'agc-08', name: 'آژانس فروش', profile: 'آژانس', blocks: ['hero', 'listings', 'cta', 'contact', 'footer'], desc: 'هیرو، فایل‌ها، اقدام، تماس' },
  { id: 'agc-09', name: 'آژانس معتبر', profile: 'آژانس', blocks: ['hero', 'services', 'stats', 'gallery', 'cta', 'footer'], desc: 'هیرو، خدمات، آمار، گالری، اقدام' },
  { id: 'agc-10', name: 'آژانس بین‌المللی', profile: 'آژانس', blocks: ['hero', 'about', 'listings', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، درباره، فایل‌ها، خدمات، نظرات، تماس', blogPage: true },

  // ───────── سازنده (۱۰) ─────────
  { id: 'bld-01', name: 'پیش‌فروش پروژه', profile: 'سازنده', blocks: ['hero', 'gallery', 'stats', 'contact', 'footer'], desc: 'هیرو، گالری پروژه، آمار، فرم' },
  { id: 'bld-02', name: 'سازندهٔ ساختمان', profile: 'سازنده', blocks: ['hero', 'about', 'gallery', 'services', 'cta', 'footer'], desc: 'هیرو، درباره، پروژه‌ها، خدمات' },
  { id: 'bld-03', name: 'انبوه‌ساز', profile: 'سازنده', blocks: ['hero', 'gallery', 'stats', 'about', 'cta', 'footer'], desc: 'هیرو، گالری، آمار، درباره، اقدام' },
  { id: 'bld-04', name: 'پروژهٔ لوکس', profile: 'سازنده', blocks: ['hero', 'gallery', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، گالری، خدمات، نظرات، تماس' },
  { id: 'bld-05', name: 'سازندهٔ مدرن', profile: 'سازنده', blocks: ['hero', 'stats', 'gallery', 'about', 'contact', 'footer'], desc: 'هیرو، آمار، گالری، درباره، تماس' },
  { id: 'bld-06', name: 'برج مسکونی', profile: 'سازنده', blocks: ['hero', 'about', 'gallery', 'stats', 'cta', 'footer'], desc: 'هیرو، معرفی، گالری، آمار، اقدام' },
  { id: 'bld-07', name: 'مجتمع تجاری', profile: 'سازنده', blocks: ['hero', 'gallery', 'services', 'stats', 'contact', 'footer'], desc: 'هیرو، گالری، خدمات، آمار، تماس' },
  { id: 'bld-08', name: 'سازندهٔ کامل', profile: 'سازنده', blocks: ['hero', 'about', 'gallery', 'stats', 'testimonials', 'cta', 'footer'], desc: 'هیرو، درباره، گالری، آمار، نظرات', blogPage: true },
  { id: 'bld-09', name: 'پروژهٔ نمونه', profile: 'سازنده', blocks: ['hero', 'gallery', 'about', 'cta', 'footer'], desc: 'هیرو، گالری، درباره، اقدام' },
  { id: 'bld-10', name: 'سازندهٔ معتبر', profile: 'سازنده', blocks: ['hero', 'stats', 'about', 'gallery', 'services', 'footer'], desc: 'هیرو، آمار، درباره، گالری، خدمات' },

  // ───────── فروشگاه (۱۰) ─────────
  { id: 'shp-01', name: 'فروشگاه مصالح', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، کاتالوگ، دسته‌ها، نظرات، تماس' },
  { id: 'shp-02', name: 'فروشگاه آنلاین', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'pricelist', 'about', 'footer'], desc: 'هیرو، کاتالوگ، نرخِ روز، درباره' },
  { id: 'shp-03', name: 'فروشگاه مدرن', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'services', 'gallery', 'cta', 'footer'], desc: 'هیرو، کاتالوگ، دسته‌ها، گالری، اقدام' },
  { id: 'shp-04', name: 'فروشگاه کامل', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'pricelist', 'stats', 'testimonials', 'footer'], desc: 'هیرو، کاتالوگ، نرخِ روز، آمار، نظرات', blogPage: true },
  { id: 'shp-05', name: 'فروشگاه تخصصی', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'about', 'testimonials', 'contact', 'footer'], desc: 'هیرو، کاتالوگ، درباره، نظرات، تماس' },
  { id: 'shp-06', name: 'فروشگاه ابزار', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'services', 'about', 'cta', 'footer'], desc: 'هیرو، کاتالوگ، دسته‌ها، درباره، اقدام' },
  { id: 'shp-07', name: 'فروشگاه دکوراسیون', profile: 'فروشگاه', blocks: ['hero', 'gallery', 'catalog', 'services', 'contact', 'footer'], desc: 'هیرو، گالری، کاتالوگ، دسته‌ها، تماس' },
  { id: 'shp-08', name: 'فروشگاه عمده', profile: 'فروشگاه', blocks: ['hero', 'pricelist', 'catalog', 'stats', 'contact', 'footer'], desc: 'هیرو، نرخِ روز، کاتالوگ، آمار، تماس' },
  { id: 'shp-09', name: 'فروشگاه برتر', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'services', 'pricelist', 'cta', 'footer'], desc: 'هیرو، کاتالوگ، دسته‌ها، نرخِ روز، اقدام' },
  { id: 'shp-10', name: 'فروشگاه نمونه', profile: 'فروشگاه', blocks: ['hero', 'catalog', 'about', 'services', 'testimonials', 'footer'], desc: 'هیرو، کاتالوگ، درباره، دسته‌ها، نظرات' },

  // ───────── سرمایه‌گذار (۱۰) ─────────
  { id: 'inv-01', name: 'سرمایه‌گذاری', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'listings', 'cta', 'contact', 'footer'], desc: 'هیرو، آمار بازده، فرصت‌ها، اقدام' },
  { id: 'inv-02', name: 'صندوق املاک', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'about', 'cta', 'footer'], desc: 'هیرو، آمار، درباره، اقدام' },
  { id: 'inv-03', name: 'فرصت سرمایه‌گذاری', profile: 'سرمایه‌گذار', blocks: ['hero', 'listings', 'stats', 'testimonials', 'contact', 'footer'], desc: 'هیرو، فرصت‌ها، آمار، نظرات، تماس' },
  { id: 'inv-04', name: 'پرتفوی ملکی', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'gallery', 'cta', 'footer'], desc: 'هیرو، آمار، گالری، اقدام' },
  { id: 'inv-05', name: 'بازده تضمینی', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'services', 'about', 'contact', 'footer'], desc: 'هیرو، آمار، خدمات، درباره، تماس' },
  { id: 'inv-06', name: 'سرمایه‌گذاری مدرن', profile: 'سرمایه‌گذار', blocks: ['hero', 'about', 'stats', 'listings', 'cta', 'footer'], desc: 'هیرو، درباره، آمار، فرصت‌ها، اقدام', blogPage: true },
  { id: 'inv-07', name: 'سرمایه‌گذاری امن', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'testimonials', 'cta', 'contact', 'footer'], desc: 'هیرو، آمار، نظرات، اقدام، تماس' },
  { id: 'inv-08', name: 'پروژهٔ سرمایه‌گذاری', profile: 'سرمایه‌گذار', blocks: ['hero', 'gallery', 'stats', 'listings', 'cta', 'footer'], desc: 'هیرو، گالری، آمار، فرصت‌ها، اقدام' },
  { id: 'inv-09', name: 'سرمایه‌گذاری کامل', profile: 'سرمایه‌گذار', blocks: ['hero', 'stats', 'services', 'listings', 'testimonials', 'footer'], desc: 'هیرو، آمار، خدمات، فرصت‌ها، نظرات' },
  { id: 'inv-10', name: 'سرمایه‌گذاری حرفه‌ای', profile: 'سرمایه‌گذار', blocks: ['hero', 'about', 'stats', 'cta', 'contact', 'footer'], desc: 'هیرو، درباره، آمار، اقدام، تماس' },

  // ───────── حقوقی (۱۰) ─────────
  { id: 'lgl-01', name: 'مشاور حقوقی', profile: 'حقوقی', blocks: ['hero', 'services', 'about', 'testimonials', 'contact', 'footer'], desc: 'هیرو، خدمات حقوقی، درباره، تماس' },
  { id: 'lgl-02', name: 'دفتر وکالت', profile: 'حقوقی', blocks: ['hero', 'about', 'services', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، تماس' },
  { id: 'lgl-03', name: 'مشاوره ملکی', profile: 'حقوقی', blocks: ['hero', 'services', 'testimonials', 'cta', 'footer'], desc: 'هیرو، خدمات، نظرات، اقدام' },
  { id: 'lgl-04', name: 'حقوقی حرفه‌ای', profile: 'حقوقی', blocks: ['hero', 'about', 'services', 'stats', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، آمار، تماس' },
  { id: 'lgl-05', name: 'وکیل پایه یک', profile: 'حقوقی', blocks: ['hero', 'services', 'about', 'cta', 'contact', 'footer'], desc: 'هیرو، خدمات، درباره، اقدام، تماس' },
  { id: 'lgl-06', name: 'حقوقی معتبر', profile: 'حقوقی', blocks: ['hero', 'services', 'stats', 'testimonials', 'footer'], desc: 'هیرو، خدمات، آمار، نظرات' },
  { id: 'lgl-07', name: 'قراردادهای ملکی', profile: 'حقوقی', blocks: ['hero', 'about', 'services', 'testimonials', 'cta', 'footer'], desc: 'هیرو، درباره، خدمات، نظرات، اقدام' },
  { id: 'lgl-08', name: 'مشاوره تخصصی', profile: 'حقوقی', blocks: ['hero', 'services', 'about', 'stats', 'cta', 'footer'], desc: 'هیرو، خدمات، درباره، آمار، اقدام' },
  { id: 'lgl-09', name: 'حقوقی کامل', profile: 'حقوقی', blocks: ['hero', 'services', 'testimonials', 'about', 'contact', 'footer'], desc: 'هیرو، خدمات، نظرات، درباره، تماس', blogPage: true },
  { id: 'lgl-10', name: 'دفتر اسناد', profile: 'حقوقی', blocks: ['hero', 'about', 'services', 'gallery', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، گالری، تماس' },

  // ───────── عمومی (۱۰) ─────────
  { id: 'gen-01', name: 'لندینگ فروش', profile: 'عمومی', blocks: ['hero', 'cta', 'services', 'testimonials', 'contact', 'footer'], desc: 'صفحهٔ تک‌برگ فروش با اقدام' },
  { id: 'gen-02', name: 'صفحهٔ ساده', profile: 'عمومی', blocks: ['hero', 'about', 'contact', 'footer'], desc: 'هیرو، درباره، تماس' },
  { id: 'gen-03', name: 'معرفی کسب‌وکار', profile: 'عمومی', blocks: ['hero', 'services', 'about', 'cta', 'footer'], desc: 'هیرو، خدمات، درباره، اقدام' },
  { id: 'gen-04', name: 'پرتال جستجو', profile: 'عمومی', blocks: ['hero', 'search', 'listings', 'contact', 'footer'], desc: 'هیرو، جستجو، فایل‌ها، تماس' },
  { id: 'gen-05', name: 'نمونه‌کار', profile: 'عمومی', blocks: ['hero', 'gallery', 'about', 'cta', 'footer'], desc: 'هیرو، گالری، درباره، اقدام' },
  { id: 'gen-06', name: 'صفحهٔ کامل', profile: 'عمومی', blocks: ['hero', 'services', 'stats', 'testimonials', 'contact', 'footer'], desc: 'هیرو، خدمات، آمار، نظرات، تماس', blogPage: true },
  { id: 'gen-07', name: 'صفحهٔ شرکتی', profile: 'عمومی', blocks: ['hero', 'about', 'services', 'gallery', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، گالری، تماس' },
  { id: 'gen-08', name: 'صفحهٔ رویداد', profile: 'عمومی', blocks: ['hero', 'about', 'gallery', 'cta', 'contact', 'footer'], desc: 'هیرو، درباره، گالری، اقدام، تماس' },
  { id: 'gen-09', name: 'صفحهٔ خدمات', profile: 'عمومی', blocks: ['hero', 'services', 'testimonials', 'cta', 'footer'], desc: 'هیرو، خدمات، نظرات، اقدام' },
  { id: 'gen-10', name: 'صفحهٔ حرفه‌ای', profile: 'عمومی', blocks: ['hero', 'stats', 'services', 'about', 'contact', 'footer'], desc: 'هیرو، آمار، خدمات، درباره، تماس' },

  // ───────── معمار و طراح داخلی (۱۰) ─────────
  { id: 'arc-01', name: 'استودیوِ مدرن', profile: 'معمار', blocks: ['hero', 'gallery', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، نمونه‌کار، خدمات، نظرات، تماس' },
  { id: 'arc-02', name: 'پرتفولیوِ تصویری', profile: 'معمار', blocks: ['hero', 'gallery', 'about', 'cta', 'footer'], desc: 'هیرو، گالریِ نمونه‌کار، درباره، اقدام' },
  { id: 'arc-03', name: 'طراحِ داخلی', profile: 'معمار', blocks: ['hero', 'services', 'gallery', 'stats', 'contact', 'footer'], desc: 'هیرو، خدمات، نمونه‌کار، آمار، تماس' },
  { id: 'arc-04', name: 'معمارِ لوکس', profile: 'معمار', blocks: ['hero', 'about', 'gallery', 'services', 'testimonials', 'footer'], desc: 'هیرو، درباره، نمونه‌کار، خدمات، نظرات', blogPage: true },
  { id: 'arc-05', name: 'استودیوِ کامل', profile: 'معمار', blocks: ['hero', 'gallery', 'stats', 'services', 'team', 'cta', 'footer'], desc: 'هیرو، نمونه‌کار، آمار، خدمات، تیم، اقدام' },
  { id: 'arc-06', name: 'طراحیِ مینیمال', profile: 'معمار', blocks: ['hero', 'about', 'gallery', 'cta', 'contact', 'footer'], desc: 'هیرو، درباره، نمونه‌کار، اقدام، تماس' },
  { id: 'arc-07', name: 'معمارِ حرفه‌ای', profile: 'معمار', blocks: ['hero', 'services', 'stats', 'gallery', 'testimonials', 'contact', 'footer'], desc: 'هیرو، خدمات، آمار، نمونه‌کار، نظرات، تماس' },
  { id: 'arc-08', name: 'نمونه‌کارمحور', profile: 'معمار', blocks: ['hero', 'gallery', 'services', 'about', 'footer'], desc: 'هیرو، گالری، خدمات، درباره' },
  { id: 'arc-09', name: 'استودیوِ خلاق', profile: 'معمار', blocks: ['hero', 'gallery', 'team', 'services', 'cta', 'footer'], desc: 'هیرو، نمونه‌کار، تیم، خدمات، اقدام' },
  { id: 'arc-10', name: 'معمارِ برتر', profile: 'معمار', blocks: ['hero', 'about', 'services', 'gallery', 'stats', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، نمونه‌کار، آمار، تماس' },

  // ───────── پیمانکار (۱۰) ─────────
  { id: 'con-01', name: 'پیمانکارِ جامع', profile: 'پیمانکار', blocks: ['hero', 'services', 'gallery', 'stats', 'contact', 'footer'], desc: 'هیرو، خدمات، پروژه‌ها، آمار، تماس' },
  { id: 'con-02', name: 'پروژه‌محور', profile: 'پیمانکار', blocks: ['hero', 'gallery', 'about', 'cta', 'footer'], desc: 'هیرو، پروژه‌ها، درباره، اقدام' },
  { id: 'con-03', name: 'اجرایِ حرفه‌ای', profile: 'پیمانکار', blocks: ['hero', 'services', 'stats', 'gallery', 'testimonials', 'footer'], desc: 'هیرو، خدمات، آمار، پروژه‌ها، نظرات', blogPage: true },
  { id: 'con-04', name: 'سازندهٔ مطمئن', profile: 'پیمانکار', blocks: ['hero', 'about', 'gallery', 'services', 'contact', 'footer'], desc: 'هیرو، درباره، پروژه‌ها، خدمات، تماس' },
  { id: 'con-05', name: 'پیمانکارِ کامل', profile: 'پیمانکار', blocks: ['hero', 'gallery', 'stats', 'services', 'team', 'cta', 'footer'], desc: 'هیرو، پروژه‌ها، آمار، خدمات، تیم، اقدام' },
  { id: 'con-06', name: 'اسکلت و سازه', profile: 'پیمانکار', blocks: ['hero', 'services', 'gallery', 'about', 'cta', 'footer'], desc: 'هیرو، خدمات، پروژه‌ها، درباره، اقدام' },
  { id: 'con-07', name: 'پیمانکارِ لوکس', profile: 'پیمانکار', blocks: ['hero', 'about', 'services', 'gallery', 'testimonials', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، پروژه‌ها، نظرات، تماس' },
  { id: 'con-08', name: 'پروژهٔ نمونه', profile: 'پیمانکار', blocks: ['hero', 'gallery', 'stats', 'cta', 'footer'], desc: 'هیرو، پروژه‌ها، آمار، اقدام' },
  { id: 'con-09', name: 'اجرایِ کامل', profile: 'پیمانکار', blocks: ['hero', 'services', 'gallery', 'stats', 'testimonials', 'footer'], desc: 'هیرو، خدمات، پروژه‌ها، آمار، نظرات' },
  { id: 'con-10', name: 'پیمانکارِ برتر', profile: 'پیمانکار', blocks: ['hero', 'about', 'gallery', 'services', 'contact', 'footer'], desc: 'هیرو، درباره، پروژه‌ها، خدمات، تماس' },

  // ───────── کارشناسِ رسمی (۱۰) ─────────
  { id: 'apr-01', name: 'کارشناسِ رسمی', profile: 'کارشناس', blocks: ['hero', 'services', 'about', 'testimonials', 'contact', 'footer'], desc: 'هیرو، خدمات، درباره، نظرات، تماس' },
  { id: 'apr-02', name: 'ارزیابِ ملک', profile: 'کارشناس', blocks: ['hero', 'about', 'services', 'stats', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، آمار، تماس' },
  { id: 'apr-03', name: 'کارشناسیِ دقیق', profile: 'کارشناس', blocks: ['hero', 'services', 'stats', 'testimonials', 'cta', 'footer'], desc: 'هیرو، خدمات، آمار، نظرات، اقدام' },
  { id: 'apr-04', name: 'کارشناسِ حرفه‌ای', profile: 'کارشناس', blocks: ['hero', 'about', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، نظرات، تماس', blogPage: true },
  { id: 'apr-05', name: 'گزارشِ رسمی', profile: 'کارشناس', blocks: ['hero', 'services', 'about', 'cta', 'contact', 'footer'], desc: 'هیرو، خدمات، درباره، اقدام، تماس' },
  { id: 'apr-06', name: 'کارشناسِ معتبر', profile: 'کارشناس', blocks: ['hero', 'services', 'stats', 'about', 'footer'], desc: 'هیرو، خدمات، آمار، درباره' },
  { id: 'apr-07', name: 'ارزیابیِ تخصصی', profile: 'کارشناس', blocks: ['hero', 'about', 'services', 'stats', 'testimonials', 'footer'], desc: 'هیرو، درباره، خدمات، آمار، نظرات' },
  { id: 'apr-08', name: 'کارشناسِ کامل', profile: 'کارشناس', blocks: ['hero', 'services', 'testimonials', 'about', 'contact', 'footer'], desc: 'هیرو، خدمات، نظرات، درباره، تماس' },
  { id: 'apr-09', name: 'کارشناسِ سریع', profile: 'کارشناس', blocks: ['hero', 'services', 'cta', 'contact', 'footer'], desc: 'هیرو، خدمات، اقدام، تماس' },
  { id: 'apr-10', name: 'کارشناسِ برتر', profile: 'کارشناس', blocks: ['hero', 'about', 'stats', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، درباره، آمار، خدمات، نظرات، تماس' },

  // ───────── دفترِ حقوقی (۱۰) ─────────
  { id: 'lwf-01', name: 'دفترِ وکالت', profile: 'دفتر حقوقی', blocks: ['hero', 'services', 'about', 'testimonials', 'contact', 'footer'], desc: 'هیرو، خدمات، درباره، نظرات، تماس' },
  { id: 'lwf-02', name: 'حقوقیِ ملکی', profile: 'دفتر حقوقی', blocks: ['hero', 'about', 'services', 'stats', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، آمار، تماس' },
  { id: 'lwf-03', name: 'وکیلِ پایه‌یک', profile: 'دفتر حقوقی', blocks: ['hero', 'services', 'testimonials', 'cta', 'footer'], desc: 'هیرو، خدمات، نظرات، اقدام' },
  { id: 'lwf-04', name: 'حقوقیِ حرفه‌ای', profile: 'دفتر حقوقی', blocks: ['hero', 'about', 'services', 'stats', 'testimonials', 'footer'], desc: 'هیرو، درباره، خدمات، آمار، نظرات' },
  { id: 'lwf-05', name: 'مشاورهٔ ملکی', profile: 'دفتر حقوقی', blocks: ['hero', 'services', 'about', 'cta', 'contact', 'footer'], desc: 'هیرو، خدمات، درباره، اقدام، تماس' },
  { id: 'lwf-06', name: 'دفترِ معتبر', profile: 'دفتر حقوقی', blocks: ['hero', 'services', 'stats', 'testimonials', 'footer'], desc: 'هیرو، خدمات، آمار، نظرات' },
  { id: 'lwf-07', name: 'قراردادِ ملکی', profile: 'دفتر حقوقی', blocks: ['hero', 'about', 'services', 'testimonials', 'cta', 'footer'], desc: 'هیرو، درباره، خدمات، نظرات، اقدام' },
  { id: 'lwf-08', name: 'حقوقیِ کامل', profile: 'دفتر حقوقی', blocks: ['hero', 'services', 'about', 'stats', 'contact', 'footer'], desc: 'هیرو، خدمات، درباره، آمار، تماس', blogPage: true },
  { id: 'lwf-09', name: 'وکالتِ تخصصی', profile: 'دفتر حقوقی', blocks: ['hero', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، خدمات، نظرات، تماس' },
  { id: 'lwf-10', name: 'دفترِ برتر', profile: 'دفتر حقوقی', blocks: ['hero', 'about', 'stats', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، درباره، آمار، خدمات، نظرات، تماس' },

  // ───────── بانک و بیمه (۱۰) ─────────
  { id: 'fin-01', name: 'تسهیلاتِ ملکی', profile: 'بانک و بیمه', blocks: ['hero', 'services', 'stats', 'testimonials', 'contact', 'footer'], desc: 'هیرو، خدمات، آمار، نظرات، تماس' },
  { id: 'fin-02', name: 'وام و بیمه', profile: 'بانک و بیمه', blocks: ['hero', 'about', 'services', 'cta', 'footer'], desc: 'هیرو، درباره، خدمات، اقدام' },
  { id: 'fin-03', name: 'مالیِ حرفه‌ای', profile: 'بانک و بیمه', blocks: ['hero', 'services', 'stats', 'about', 'contact', 'footer'], desc: 'هیرو، خدمات، آمار، درباره، تماس' },
  { id: 'fin-04', name: 'بیمهٔ کامل', profile: 'بانک و بیمه', blocks: ['hero', 'services', 'testimonials', 'cta', 'contact', 'footer'], desc: 'هیرو، خدمات، نظرات، اقدام، تماس' },
  { id: 'fin-05', name: 'تسهیلاتِ ساخت', profile: 'بانک و بیمه', blocks: ['hero', 'about', 'services', 'stats', 'cta', 'footer'], desc: 'هیرو، درباره، خدمات، آمار، اقدام', blogPage: true },
  { id: 'fin-06', name: 'مالیِ معتبر', profile: 'بانک و بیمه', blocks: ['hero', 'stats', 'services', 'testimonials', 'footer'], desc: 'هیرو، آمار، خدمات، نظرات' },
  { id: 'fin-07', name: 'مشاورهٔ مالی', profile: 'بانک و بیمه', blocks: ['hero', 'services', 'about', 'testimonials', 'contact', 'footer'], desc: 'هیرو، خدمات، درباره، نظرات، تماس' },
  { id: 'fin-08', name: 'وامِ مسکن', profile: 'بانک و بیمه', blocks: ['hero', 'services', 'cta', 'stats', 'contact', 'footer'], desc: 'هیرو، خدمات، اقدام، آمار، تماس' },
  { id: 'fin-09', name: 'بیمهٔ تخصصی', profile: 'بانک و بیمه', blocks: ['hero', 'about', 'services', 'stats', 'testimonials', 'footer'], desc: 'هیرو، درباره، خدمات، آمار، نظرات' },
  { id: 'fin-10', name: 'مالیِ برتر', profile: 'بانک و بیمه', blocks: ['hero', 'services', 'stats', 'about', 'cta', 'contact', 'footer'], desc: 'هیرو، خدمات، آمار، درباره، اقدام، تماس' },

  // ───────── دفترخانه (۱۰) ─────────
  { id: 'ntr-01', name: 'دفترِ اسناد', profile: 'دفترخانه', blocks: ['hero', 'services', 'about', 'contact', 'footer'], desc: 'هیرو، خدمات، درباره، تماس' },
  { id: 'ntr-02', name: 'ثبتیِ سریع', profile: 'دفترخانه', blocks: ['hero', 'services', 'stats', 'cta', 'contact', 'footer'], desc: 'هیرو، خدمات، آمار، اقدام، تماس' },
  { id: 'ntr-03', name: 'دفترخانهٔ مدرن', profile: 'دفترخانه', blocks: ['hero', 'about', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، نظرات، تماس' },
  { id: 'ntr-04', name: 'اسنادِ رسمی', profile: 'دفترخانه', blocks: ['hero', 'services', 'about', 'cta', 'footer'], desc: 'هیرو، خدمات، درباره، اقدام' },
  { id: 'ntr-05', name: 'دفترِ معتبر', profile: 'دفترخانه', blocks: ['hero', 'services', 'stats', 'testimonials', 'footer'], desc: 'هیرو، خدمات، آمار، نظرات', blogPage: true },
  { id: 'ntr-06', name: 'نوبت‌دهیِ آنلاین', profile: 'دفترخانه', blocks: ['hero', 'services', 'cta', 'contact', 'footer'], desc: 'هیرو، خدمات، اقدام، تماس' },
  { id: 'ntr-07', name: 'دفترخانهٔ کامل', profile: 'دفترخانه', blocks: ['hero', 'about', 'services', 'stats', 'contact', 'footer'], desc: 'هیرو، درباره، خدمات، آمار، تماس' },
  { id: 'ntr-08', name: 'خدماتِ ثبتی', profile: 'دفترخانه', blocks: ['hero', 'services', 'testimonials', 'about', 'footer'], desc: 'هیرو، خدمات، نظرات، درباره' },
  { id: 'ntr-09', name: 'دفترِ تخصصی', profile: 'دفترخانه', blocks: ['hero', 'services', 'about', 'gallery', 'contact', 'footer'], desc: 'هیرو، خدمات، درباره، گالری، تماس' },
  { id: 'ntr-10', name: 'دفترخانهٔ برتر', profile: 'دفترخانه', blocks: ['hero', 'about', 'stats', 'services', 'testimonials', 'contact', 'footer'], desc: 'هیرو، درباره، آمار، خدمات، نظرات، تماس' },
]

// ── سایتِ کامل (multi-page) — هر قالبِ اصلی یک وبسایتِ کامل با همهٔ صفحات می‌سازد ──
// متناسب با پروفایل، صفحاتِ عمومیِ آماده (درباره، فایل‌ها/پروژه‌ها/محصولات، خدمات،
// تیم، وبلاگ، تماس) با هیرو + محتوا + فوتر ساخته می‌شوند تا کاربر یک سایتِ کاملِ
// چندصفحه‌ای تحویل بگیرد، نه فقط یک صفحهٔ تک‌برگ.
export interface PageSpec { slug: string; title: string; menuLabel: string; blocks: string[]; heroHeading: string; heroSub: string }
export function profilePageSpec(profile: string): PageSpec[] {
  const about: PageSpec = { slug: 'about', title: 'درباره ما', menuLabel: 'درباره ما', blocks: ['hero', 'about', 'stats', 'cta', 'footer'], heroHeading: 'درباره ما', heroSub: 'با ما و مسیرِ حرفه‌ای‌مان بیشتر آشنا شوید' }
  const aboutTeam: PageSpec = { slug: 'about', title: 'درباره ما', menuLabel: 'درباره ما', blocks: ['hero', 'about', 'stats', 'team', 'cta', 'footer'], heroHeading: 'درباره ما', heroSub: 'تیمِ حرفه‌ای و ارزش‌هایِ ما' }
  const services: PageSpec = { slug: 'services', title: 'خدمات', menuLabel: 'خدمات', blocks: ['hero', 'services', 'testimonials', 'cta', 'footer'], heroHeading: 'خدماتِ ما', heroSub: 'آنچه برای شما انجام می‌دهیم' }
  const blog: PageSpec = { slug: 'blog', title: 'وبلاگ', menuLabel: 'وبلاگ', blocks: ['blogfull', 'footer'], heroHeading: 'وبلاگ', heroSub: 'تازه‌ترین مقالات و اخبار' }
  const contact: PageSpec = { slug: 'contact', title: 'تماس با ما', menuLabel: 'تماس', blocks: ['hero', 'contact', 'footer'], heroHeading: 'تماس با ما', heroSub: 'برای مشاوره و هماهنگی با ما در ارتباط باشید' }
  const listings: PageSpec = { slug: 'listings', title: 'فایل‌ها', menuLabel: 'فایل‌ها', blocks: ['hero', 'searchlist', 'footer'], heroHeading: 'فایل‌های ملکی', heroSub: 'جدیدترین فایل‌های خرید، فروش و اجاره' }
  const team: PageSpec = { slug: 'team', title: 'تیم ما', menuLabel: 'تیم ما', blocks: ['hero', 'team', 'cta', 'footer'], heroHeading: 'تیمِ مشاوران', heroSub: 'با مشاورانِ خبرهٔ ما آشنا شوید' }
  const projects: PageSpec = { slug: 'projects', title: 'پروژه‌ها', menuLabel: 'پروژه‌ها', blocks: ['hero', 'gallery', 'stats', 'cta', 'footer'], heroHeading: 'پروژه‌های ما', heroSub: 'نمونه‌کارها و پروژه‌های در حالِ ساخت' }
  const products: PageSpec = { slug: 'products', title: 'محصولات', menuLabel: 'محصولات', blocks: ['hero', 'catalog', 'pricelist', 'footer'], heroHeading: 'محصولات', heroSub: 'کاتالوگِ کاملِ محصولاتِ ما' }
  const categories: PageSpec = { slug: 'prices', title: 'نرخِ روز', menuLabel: 'نرخِ روز', blocks: ['hero', 'pricelist', 'cta', 'footer'], heroHeading: 'نرخِ روزِ مصالح', heroSub: 'قیمتِ به‌روزِ محصولاتِ ما' }
  const opportunities: PageSpec = { slug: 'opportunities', title: 'فرصت‌ها', menuLabel: 'فرصت‌ها', blocks: ['hero', 'stats', 'searchlist', 'cta', 'footer'], heroHeading: 'فرصت‌های سرمایه‌گذاری', heroSub: 'بازده و فرصت‌هایِ منتخبِ ملکی' }
  const portfolio: PageSpec = { slug: 'portfolio', title: 'نمونه‌کارها', menuLabel: 'نمونه‌کارها', blocks: ['hero', 'gallery', 'stats', 'cta', 'footer'], heroHeading: 'نمونه‌کارها و پروژه‌ها', heroSub: 'گزیده‌ای از پروژه‌های طراحی و اجراشدهٔ ما' }
  switch (profile) {
    case 'مشاور': return [about, listings, services, blog, contact]
    case 'آژانس': return [aboutTeam, listings, services, team, blog, contact]
    case 'سازنده': return [about, projects, services, blog, contact]
    case 'فروشگاه': return [about, products, categories, blog, contact]
    case 'سرمایه‌گذار': return [about, opportunities, services, blog, contact]
    case 'حقوقی': return [about, services, blog, contact]
    case 'معمار': return [about, portfolio, services, blog, contact]
    case 'پیمانکار': return [about, portfolio, services, blog, contact]
    case 'کارشناس': return [about, services, blog, contact]
    case 'دفتر حقوقی': return [aboutTeam, services, blog, contact]
    case 'بانک و بیمه': return [about, services, blog, contact]
    case 'دفترخانه': return [about, services, blog, contact]
    default: return [about, services, blog, contact]
  }
}

// ── سازندهٔ خالصِ «سایتِ کاملِ یک پروفایل» — همان کاری که loadTemplateِ ابزار می‌کند ──
// خروجی: تم + سئو + همهٔ صفحات (خانه + درباره/فایل‌ها/خدمات/تیم/وبلاگ/تماس و…) با
// محتوای حرفه‌ایِ صنفی. شناسهٔ بلوک‌ها در کلِ سایت یکتاست (شمارندهٔ محلی).
export interface TplBlock { id: number; type: string; props: Record<string, any> }
export interface TplPage { slug: string; title: string; inMenu?: boolean; menuLabel?: string; blocks: TplBlock[] }
export interface BuiltSite { theme: Required<Omit<Theme, 'font'>>; seoTitle: string; seoDesc: string; tplName: string; pages: TplPage[] }

const cloneJ = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

export function buildProfileSite(profile: string, tplIn?: { id: string; name: string; profile: string; blocks: string[] }): BuiltSite {
  const tpl = tplIn || STARTER_TEMPLATES.find(t => t.profile === profile) || STARTER_TEMPLATES.find(t => t.profile === 'عمومی')!
  let id = 1
  const make = (type: string, preset?: Record<string, any>): TplBlock => {
    const props = cloneJ(BLOCK_DEFAULTS[type] || { heading: type })
    if (preset) Object.assign(props, cloneJ(preset))
    return { id: id++, type, props }
  }
  const pal = templatePalette(tpl)
  const copy = PROFILE_HERO_COPY[tpl.profile] || PROFILE_HERO_COPY['عمومی']
  const heroBg = `linear-gradient(135deg, ${pal.primary}, ${pal.secondary} 72%)`
  const pp = PROFILE_PRESETS[tpl.profile]
  // بلوک‌سازِ مشترک: هیرو/cta/footer پیش‌فرضِ متناسب می‌گیرند + محتوایِ صنفی.
  const build = (type: string, opts?: { heading?: string; sub?: string; btn?: string }): TplBlock => {
    let preset: Record<string, any> | undefined
    if (type === 'hero') preset = { heading: opts?.heading ?? copy.heading, subheading: opts?.sub ?? copy.subheading, buttonText: opts?.btn ?? copy.buttonText, bg: heroBg, ...(pp?.eyebrow ? { eyebrow: pp.eyebrow } : {}) }
    else if (type === 'cta') preset = { bg: heroBg }
    else if (type === 'footer') preset = { brand: tpl.name, ...(pp?.footerAbout ? { about: pp.footerAbout } : {}) }
    else if (type === 'blogfull') preset = { heading: opts?.heading ?? 'وبلاگ' }
    else if (type === 'blog') preset = { heading: opts?.heading ?? 'آخرین مقالات', count: 3 }
    else if (type === 'services' && pp?.services) preset = { heading: pp.servicesHeading || 'خدمات ما', items: pp.services }
    else if (type === 'about' && pp?.about) preset = { heading: pp.aboutHeading || 'درباره ما', text: pp.about }
    else if (type === 'stats' && pp?.stats) preset = { items: pp.stats }
    else if (type === 'gallery' && pp?.galleryHeading) preset = { heading: pp.galleryHeading }
    return make(type, preset)
  }
  // ── صفحهٔ اصلیِ حرفه‌ای و کامل، متناسب با پروفایل (عینِ loadTemplateِ ابزار) ──
  const galleryProfiles = ['سازنده', 'معمار', 'پیمانکار']
  const servicesProfiles = ['حقوقی', 'کارشناس', 'دفتر حقوقی', 'بانک و بیمه', 'دفترخانه']
  const offeringsType = tpl.profile === 'فروشگاه' ? 'catalog' : galleryProfiles.includes(tpl.profile) ? 'gallery' : servicesProfiles.includes(tpl.profile) ? 'services' : 'listings'
  const isShop = tpl.profile === 'فروشگاه'
  const baseTypes = ['hero', 'footer', 'cta', 'listings', 'gallery', 'services', 'stats', 'testimonials', 'search', 'catalog', 'pricelist']
  const distinct = tpl.blocks.filter(b => !baseTypes.includes(b))
  const hasSearch = tpl.blocks.includes('search') && !isShop
  const homeOrder = isShop ? [
    'hero', 'catalog',
    ...(tpl.blocks.includes('pricelist') ? ['pricelist'] : []),
    ...distinct,
    'services', 'testimonials', 'blog', 'cta', 'footer',
  ] : [
    'hero',
    ...(hasSearch ? ['search'] : []),
    offeringsType,
    ...distinct,
    'services', 'stats', 'testimonials', 'blog', 'cta', 'footer',
  ]
  const homeTypes = Array.from(new Set(homeOrder))
  const pages: TplPage[] = [{ slug: 'home', title: 'صفحه اصلی', blocks: homeTypes.map(type => build(type)) }]
  for (const spec of profilePageSpec(tpl.profile)) {
    pages.push({ slug: spec.slug, title: spec.title, inMenu: true, menuLabel: spec.menuLabel, blocks: spec.blocks.map(type => build(type, { heading: spec.heroHeading, sub: spec.heroSub, btn: 'تماس با ما' })) })
  }
  return { theme: { ...pal }, seoTitle: pp?.seoTitle || '', seoDesc: pp?.seoDesc || '', tplName: tpl.name, pages }
}
