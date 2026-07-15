import { join } from 'path'
import { createHmac } from 'crypto'
import { readJsonCached, writeJsonCached } from './json-file'

const DATA_FILE = join(process.cwd(), '.admin-data.json')

function salt() {
  return process.env.JWT_SECRET || 'melkjet-default-secret-change-in-prod'
}

export function hashPassword(password: string): string {
  return createHmac('sha256', salt()).update(password).digest('hex')
}

export interface AdminData {
  email: string
  passwordHash: string
  ippanel?: {
    apiKey: string
    sender: string
    pattern: string
    patternVar?: string   // نام متغیر کد در پترن IPPanel (پیش‌فرض: code)
    automationPattern?: string  // (اختیاری) پترنِ متغیرِ آزاد برای پیامکِ اتوماسیون؛ خالی = متنِ آزاد bulk
    automationVar?: string      // نامِ متغیرِ آن پترن (پیش‌فرض: message)
    outreachPattern?: string    // پترنِ دعوتِ صاحبانِ آگهیِ اسکرپ‌شده (متغیرِ نام)
    outreachVar?: string        // نامِ متغیرِ پترنِ دعوت (پیش‌فرض: name)
    linkVar?: string            // نامِ متغیرِ «لینک» در پترن‌ها (مثلاً link)؛ اگر تنظیم شود،
                                // در هر پترنِ لینک‌دار، لینکِ کوتاه‌شده در این متغیر فرستاده می‌شود
  }
  smtp?: {
    host: string
    port: number
    user: string
    pass: string
    from: string
  }
  neshan?: {
    serviceKey: string   // Neshan web-service key (search / reverse / distance-matrix) — «service.…»
    mapKey?: string      // Neshan map key (static map / map display) — «web.…»
  }
  divar?: {
    proxyUrl?: string    // HTTP proxy used to reach api.divar.ir from the server
  }
  gapgpt?: {              // ارائه‌دهندهٔ پیش‌فرض (گپ) — همهٔ ایجنت‌ها مگر آن‌ها که provider خاص دارند
    baseUrl: string      // e.g. https://api.gapgpt.app/v1
    apiKey: string
  }
  // ارائه‌دهنده‌های اضافیِ سازگار با OpenAI (مثلِ aval). کلید = شناسهٔ provider (مثلاً 'aval').
  // هر ایجنت می‌تواند با textProvider/imageProvider یکی از این‌ها را به‌جای پیش‌فرض استفاده کند.
  providers?: Record<string, { label?: string; baseUrl: string; apiKey: string }>
  // کوتاه‌کنندهٔ لینک (nxal) برای پیامکِ ترکر — لینکِ آگهی کوتاه و کلیک‌ها شمرده می‌شوند.
  shortener?: { apiKey: string; baseUrl?: string; domain?: string; siteBase?: string }
  arvan?: {              // پاس‌انبان آروان (S3) — (برای بینایی گپ جواب نداد؛ نگه‌داری شده)
    endpoint: string
    bucket: string
    accessKey: string
    secretKey: string
    region?: string
  }
  imgbb?: {              // imgbb — میزبانی عکس روی i.ibb.co که سرورِ گپ می‌تواند فِچ کند
    apiKey: string
  }
  zarinpal?: {           // درگاه پرداخت زرین‌پال (داخلی)
    merchantId: string
    sandbox?: boolean
  }
  negotiation?: {        // موتور مذاکره — قواعدِ تولیدِ پیام + پترنِ ارسالِ سریعِ پیامک
    rules?: string       // قواعدی که هوش مصنوعی بر اساسِ آن‌ها پیامِ مذاکره را تولید می‌کند
    pattern?: string     // کدِ پترنِ IPPanel برای ارسالِ سریعِ پیامک (اختیاری)
    patternVar?: string  // نامِ متغیرِ پترن (پیش‌فرض: message)
  }
  webpush?: {            // کلیدهای VAPID برای پوش‌نوتیفیکیشنِ مرورگری (یک‌بار خودکار ساخته می‌شوند)
    publicKey: string
    privateKeyPem: string
    subject?: string
  }
  podium?: {             // احرازِ هویتِ شاهکار (Pod.ir) — استعلامِ ثبت‌احوال + تطبیقِ موبایل↔کدملی
    token?: string
    idKey?: string       // GET_IDENTITY_INFO_API_KEY
    matchKey?: string    // MATCH_NATIONAL_ID_AND_PHONE_NUMBER_API_KEY
    idProduct?: string
    matchProduct?: string
    url?: string
    enabled?: boolean    // اگر روشن باشد، ثبت‌نامِ کاربرِ جدید نیازمندِ تأییدِ شاهکار است
  }
  profileGate?: {        // سامانهٔ خودکارِ تکمیلِ پروفایل: هشدارِ پیامکی + تعلیقِ پنل
    enabled?: boolean
    minPercent?: number  // حداقلِ درصدِ تکمیل (پیش‌فرض ۷۰)
    graceDays?: number   // مهلتِ تکمیل پس از هشدار (پیش‌فرض ۳ روز)
    pattern?: string     // کدِ پترنِ IPPanel (اختیاری)
    patternVar?: string
  }
  alerts?: {             // هشدارِ «آگهی جدید اومد خبرم کن» — پیامک با پترن
    enabled?: boolean
    pattern?: string     // کدِ پترنِ IPPanel (اختیاری)
    patternVar?: string  // نامِ متغیرِ پترن (پیش‌فرض: message)
  }
  tracker?: {            // ترکر + پیامکِ هدفمندِ بازاریابی مجدد
    enabled?: boolean    // فعال/غیرفعال
    template?: string    // قالبِ پیام — متغیرها: %title% %url%
    pattern?: string     // کدِ پترنِ IPPanel برای ارسالِ سریع (اختیاری)
    patternVar?: string  // نامِ متغیرِ پترن (پیش‌فرض: message)
    delayMin?: number    // تأخیر تا ارسال (دقیقه) — پس از بازدید
    throttleHours?: number // حداقل فاصلهٔ دو پیامک برای یک کاربر (ساعت)
    paths?: string       // پیشوندهای مسیر که پیامک را فعال می‌کنند (هر خط یکی؛ خالی=همهٔ صفحات عمومی)
  }
  moderation?: {          // معیارهای ممیزیِ آگهی (سوپرادمین تعریف می‌کند؛ AI بر اساسش تصمیم می‌گیرد و ML یاد می‌گیرد)
    criteria?: string     // متنِ معیارها (به AI داده می‌شود). خالی = پیش‌فرض
    approveMin?: number   // امتیاز ≥ این → تأیید (پیش‌فرض ۷۰)
    rejectMax?: number    // امتیاز ≤ این → رد (پیش‌فرض ۴۰)؛ بینِ این‌دو → بازبینیِ دستی
    requirePrice?: boolean // آگهیِ بدونِ قیمت به‌صورتِ خودکار رد/بازبینی شود
    priceMissing?: 'reject' | 'review'  // اگر قیمت نبود چه‌کار (پیش‌فرض reject)
    autoMl?: boolean      // آیا مدلِ یادگیرنده وقتی مطمئن شد خودش تصمیم بگیرد (پیش‌فرض true)
    autoRejectContact?: boolean  // فاز ۱۳۸: ردِ خودکار با مدرکِ قطعیِ شماره/لینک/آیدیِ تماس در متن (پیش‌فرض true)
  }
  // تخصیصِ مدل به‌ازای هر ایجنت + (اختیاری) provider به‌ازای هر اسلات. provider خالی = پیش‌فرض (گپ).
  agentModels?: Record<string, { text?: string; image?: string; textProvider?: string; imageProvider?: string }>
}

export function getAdminData(): AdminData {
  const d = readJsonCached<AdminData | null>(DATA_FILE, null)
  if (d) return d
  return {
    email: process.env.ADMIN_EMAIL || 'naeiniamini@gmail.com',
    passwordHash: hashPassword(process.env.ADMIN_PASSWORD || 'Admin@123456'),
  }
}

export function saveAdminData(data: AdminData) {
  writeJsonCached(DATA_FILE, data, true)
}
