// گزینه‌های استانداردِ پروفایلِ کسب‌وکار (تخصص‌ها / خدمات) — قابل‌مدیریت در سوپرادمین.
// دلیل: ورودیِ آزادِ متنی برای ML قابل‌اندازه‌گیری نیست؛ لیستِ استاندارد = دادهٔ ساخت‌یافته.
// الگوی فایل‌محورِ config-مانند (مثل role/account) — کم‌تغییر و تک‌نویسنده.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface ProfileOptions { specialties: string[]; services: string[] }

// تاکسونومیِ استانداردِ حوزهٔ املاک (seed — ادمین آزادانه ویرایش/حذف/اضافه می‌کند).
export const DEFAULT_PROFILE_OPTIONS: ProfileOptions = {
  specialties: [
    'آپارتمان مسکونی', 'آپارتمان لوکس', 'ویلا', 'زمین و کلنگی', 'تجاری و مغازه', 'اداری',
    'پیش‌فروش', 'مشارکت در ساخت', 'رهن و اجاره', 'خرید و فروش', 'باغ و باغچه', 'سوله و صنعتی',
  ],
  services: [
    'مشاورهٔ خرید', 'مشاورهٔ فروش', 'مشاورهٔ سرمایه‌گذاری', 'کارشناسیِ قیمت', 'عکاسی و تورِ مجازی',
    'تنظیمِ قرارداد', 'مدیریتِ اجاره', 'بازاریابیِ ملک', 'اخذِ وام و تسهیلات', 'امورِ ثبتی و سند',
  ],
}

const FILE = join(process.cwd(), '.profile-options-data.json')

export function getProfileOptions(): ProfileOptions {
  if (existsSync(FILE)) {
    try {
      const d = JSON.parse(readFileSync(FILE, 'utf-8')) as Partial<ProfileOptions>
      return {
        specialties: Array.isArray(d.specialties) ? d.specialties : DEFAULT_PROFILE_OPTIONS.specialties,
        services: Array.isArray(d.services) ? d.services : DEFAULT_PROFILE_OPTIONS.services,
      }
    } catch {}
  }
  return DEFAULT_PROFILE_OPTIONS
}

const clean = (xs: unknown) => [...new Set((Array.isArray(xs) ? xs : []).map(x => String(x).trim().slice(0, 60)).filter(Boolean))].slice(0, 200)

export function setProfileOptions(patch: Partial<ProfileOptions>): ProfileOptions {
  const cur = getProfileOptions()
  const next: ProfileOptions = {
    specialties: patch.specialties !== undefined ? clean(patch.specialties) : cur.specialties,
    services: patch.services !== undefined ? clean(patch.services) : cur.services,
  }
  try { writeFileSync(FILE, JSON.stringify(next)) } catch {}
  return next
}
