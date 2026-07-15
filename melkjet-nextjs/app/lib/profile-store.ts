import { join } from 'path'
import { readJsonCached, writeJsonCached } from './json-file'

// پروفایلِ کاملِ کسب‌وکار/شخص — per-user (شمارهٔ کاربر). هویتِ رسمی از account (شاهکار) می‌آید؛
// این‌جا اطلاعاتِ کسب‌وکار، تماس، موقعیت، معرفی و شبکه‌های اجتماعی نگه‌داری می‌شود.
const DATA_FILE = join(process.cwd(), '.profile-data.json')

export interface BusinessProfile {
  kind: 'personal' | 'business'        // شخصی یا کسب‌وکار
  displayName: string                   // نامِ نمایشی (پیش‌فرض از هویت)
  businessName: string                  // نامِ کسب‌وکار / برند
  businessType: string                  // نوعِ فعالیت
  licenseNumber: string                 // شمارهٔ پروانه/جواز
  legalNationalId: string               // شناسهٔ ملیِ شخصِ حقوقی
  economicCode: string                  // کدِ اقتصادی
  establishedYear: string               // سالِ تأسیس
  employees: string                     // تعدادِ پرسنل
  tagline: string                       // معرفیِ کوتاه (شعار)
  about: string                         // دربارهٔ ما (کامل)
  logo: string                          // لوگو
  cover: string                         // تصویرِ کاور
  landline: string                      // تلفنِ ثابت
  contactPhone: string                  // شمارهٔ تماسِ نمایشی برای مشتری
  email: string
  website: string
  province: string
  city: string
  neighborhood: string
  address: string
  postalCode: string
  workHours: string                     // ساعاتِ کاری
  specialties: string[]                 // تخصص‌ها
  services: string[]                    // خدمات
  areas: string[]                       // مناطقِ فعالیت
  social: { instagram?: string; telegram?: string; whatsapp?: string; eitaa?: string; linkedin?: string }
  updatedAt: number
}

type DB = Record<string, BusinessProfile>
function load(): DB { return readJsonCached<DB>(DATA_FILE, {}) }
function save(db: DB) { writeJsonCached(DATA_FILE, db, true) }

export function emptyProfile(): BusinessProfile {
  return {
    kind: 'business', displayName: '', businessName: '', businessType: '', licenseNumber: '', legalNationalId: '', economicCode: '',
    establishedYear: '', employees: '', tagline: '', about: '', logo: '', cover: '', landline: '', contactPhone: '', email: '', website: '',
    province: '', city: '', neighborhood: '', address: '', postalCode: '', workHours: '', specialties: [], services: [], areas: [],
    social: {}, updatedAt: 0,
  }
}

export function getProfile(phone: string): BusinessProfile { return { ...emptyProfile(), ...(load()[phone] || {}) } }

const arr = (v: any): string[] => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean).slice(0, 40) : (typeof v === 'string' ? v.split(/[،,\n]+/).map(s => s.trim()).filter(Boolean) : [])
const str = (v: any, max = 400) => String(v ?? '').slice(0, max)

export function saveProfile(phone: string, patch: Partial<BusinessProfile>): BusinessProfile {
  const db = load()
  const cur = { ...emptyProfile(), ...(db[phone] || {}) }
  const p: BusinessProfile = {
    ...cur,
    kind: patch.kind === 'personal' ? 'personal' : (patch.kind === 'business' ? 'business' : cur.kind),
    displayName: patch.displayName !== undefined ? str(patch.displayName, 80) : cur.displayName,
    businessName: patch.businessName !== undefined ? str(patch.businessName, 120) : cur.businessName,
    businessType: patch.businessType !== undefined ? str(patch.businessType, 80) : cur.businessType,
    licenseNumber: patch.licenseNumber !== undefined ? str(patch.licenseNumber, 60) : cur.licenseNumber,
    legalNationalId: patch.legalNationalId !== undefined ? str(patch.legalNationalId, 20) : cur.legalNationalId,
    economicCode: patch.economicCode !== undefined ? str(patch.economicCode, 30) : cur.economicCode,
    establishedYear: patch.establishedYear !== undefined ? str(patch.establishedYear, 8) : cur.establishedYear,
    employees: patch.employees !== undefined ? str(patch.employees, 10) : cur.employees,
    tagline: patch.tagline !== undefined ? str(patch.tagline, 160) : cur.tagline,
    about: patch.about !== undefined ? str(patch.about, 3000) : cur.about,
    logo: patch.logo !== undefined ? str(patch.logo, 100000) : cur.logo,
    cover: patch.cover !== undefined ? str(patch.cover, 100000) : cur.cover,
    landline: patch.landline !== undefined ? str(patch.landline, 30) : cur.landline,
    contactPhone: patch.contactPhone !== undefined ? str(patch.contactPhone, 20) : cur.contactPhone,
    email: patch.email !== undefined ? str(patch.email, 120) : cur.email,
    website: patch.website !== undefined ? str(patch.website, 160) : cur.website,
    province: patch.province !== undefined ? str(patch.province, 60) : cur.province,
    city: patch.city !== undefined ? str(patch.city, 60) : cur.city,
    neighborhood: patch.neighborhood !== undefined ? str(patch.neighborhood, 60) : cur.neighborhood,
    address: patch.address !== undefined ? str(patch.address, 400) : cur.address,
    postalCode: patch.postalCode !== undefined ? str(patch.postalCode, 12) : cur.postalCode,
    workHours: patch.workHours !== undefined ? str(patch.workHours, 200) : cur.workHours,
    specialties: patch.specialties !== undefined ? arr(patch.specialties) : cur.specialties,
    services: patch.services !== undefined ? arr(patch.services) : cur.services,
    areas: patch.areas !== undefined ? arr(patch.areas) : cur.areas,
    social: patch.social !== undefined ? {
      instagram: str(patch.social?.instagram, 120), telegram: str(patch.social?.telegram, 120),
      whatsapp: str(patch.social?.whatsapp, 30), eitaa: str(patch.social?.eitaa, 120), linkedin: str(patch.social?.linkedin, 160),
    } : cur.social,
    updatedAt: Date.now(),
  }
  db[phone] = p; save(db)
  return p
}

// درصدِ تکمیلِ پروفایل (برای نوارِ پیشرفت)
// فاز ۱۴۲ — ادغامِ پروفایلِ عمومی: فیلدهای خالیِ مقصد از مبدأ پر می‌شود؛ مبدأ حذف.
export function mergeProfiles(from: string, to: string): void {
  const db = load()
  const src = db[from]
  if (!src) return
  const dst = db[to] = { ...emptyProfile(), ...(db[to] || {}) }
  for (const k of Object.keys(src) as (keyof BusinessProfile)[]) {
    const v = src[k]
    const cur = dst[k]
    const empty = cur === undefined || cur === '' || (Array.isArray(cur) && cur.length === 0)
    if (empty && v !== undefined && v !== '') (dst as any)[k] = v
  }
  delete db[from]
  save(db)
}

export function completeness(p: BusinessProfile): number {
  const checks = [p.displayName || p.businessName, p.businessType, p.tagline, p.about, p.logo, p.contactPhone || p.landline, p.city, p.address, p.specialties.length > 0, p.workHours, p.social.instagram || p.social.telegram || p.social.whatsapp]
  const done = checks.filter(Boolean).length
  return Math.round((done / checks.length) * 100)
}
