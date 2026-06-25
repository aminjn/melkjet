// نگاشتِ فیلدهای هویتیِ شاهکار (Pod.ir) به برچسبِ فارسی — کاملاً سمتِ کلاینت (بدونِ وابستگیِ سرور).
// هدف: نمایشِ «همهٔ» فیلدهایی که سامانهٔ شاهکار برمی‌گرداند، چه شناخته‌شده و چه ناشناخته.

export const IDENTITY_FIELD_ORDER: { key: string; label: string; ltr?: boolean }[] = [
  { key: 'nationalCode', label: 'کد ملی', ltr: true },
  { key: 'fullName', label: 'نامِ کامل' },
  { key: 'firstName', label: 'نام' },
  { key: 'lastName', label: 'نام خانوادگی' },
  { key: 'fatherName', label: 'نامِ پدر' },
  { key: 'gender', label: 'جنسیت' },
  { key: 'birthDate', label: 'تاریخِ تولد', ltr: true },
  { key: 'birthDateGregorian', label: 'تاریخِ تولد (میلادی)', ltr: true },
  { key: 'birthPlace', label: 'محلِ تولد' },
  { key: 'birthPlaceCode', label: 'کدِ محلِ تولد', ltr: true },
  { key: 'identificationNumber', label: 'شمارهٔ شناسنامه', ltr: true },
  { key: 'idSerial', label: 'سری و سریالِ شناسنامه', ltr: true },
  { key: 'identificationSerialCode', label: 'سریِ شناسنامه', ltr: true },
  { key: 'identificationSerialNumber', label: 'سریالِ شناسنامه', ltr: true },
  { key: 'issuancePlace', label: 'محلِ صدور' },
  { key: 'issuancePlaceCode', label: 'کدِ محلِ صدور', ltr: true },
  { key: 'officeCode', label: 'کدِ ادارهٔ ثبت', ltr: true },
  { key: 'originalOfficeCode', label: 'کدِ ادارهٔ ثبتِ اصلی', ltr: true },
  { key: 'postalCode', label: 'کدِ پستی', ltr: true },
  { key: 'alive', label: 'وضعیتِ حیات' },
  { key: 'deathDate', label: 'تاریخِ فوت', ltr: true },
  { key: 'description', label: 'توضیحات' },
]

// برچسبِ فارسیِ فیلدهای کم‌تردیدِ دیگری که ممکن است بیایند
const EXTRA_LABELS: Record<string, string> = {
  motherName: 'نامِ مادر', mobile: 'موبایل', phone: 'تلفن', address: 'نشانی',
  province: 'استان', city: 'شهر', maritalStatus: 'وضعیتِ تأهل', religion: 'دین',
}
const HIDDEN = new Set(['raw', 'alterations', 'nationalCodeDescription'])

export function genderFa(g: any): string {
  const s = String(g ?? '').trim().toLowerCase()
  if (['male', 'm', '1', 'مرد', 'آقا'].includes(s)) return 'مرد'
  if (['female', 'f', '0', '2', 'زن', 'خانم'].includes(s)) return 'زن'
  return g ? String(g) : ''
}
function fmt(key: string, v: any): string {
  if (v == null || v === '') return ''
  if (key === 'gender') return genderFa(v)
  if (key === 'alive') return v === true ? 'در قیدِ حیات' : v === false ? 'فوت‌شده' : String(v)
  if (typeof v === 'boolean') return v ? 'بله' : 'خیر'
  if (typeof v === 'object') return ''
  return String(v)
}

// ورودی: یک شیِ حساب‌مانند (nationalId/idNumber/idSerial/identityRaw…) یا خودِ identityRaw.
// خروجی: ردیف‌های آماده برای نمایش — همهٔ فیلدهای موجود، شناخته‌شده اول، ناشناخته‌ها بعد.
export function buildIdentityRows(a: any): { label: string; value: string; ltr?: boolean }[] {
  if (!a) return []
  const raw = (a.identityRaw && typeof a.identityRaw === 'object') ? a.identityRaw : (a.raw && typeof a.raw === 'object' ? a.raw : null)
  const merged: any = {
    nationalCode: a.nationalId || a.nationalCode,
    firstName: a.firstName, lastName: a.lastName, fatherName: a.fatherName,
    gender: a.gender, birthDate: a.birthDate, birthPlace: a.birthPlace,
    birthPlaceCode: a.birthPlaceCode, identificationNumber: a.idNumber || a.identificationNumber,
    idSerial: a.idSerial,
    ...(raw || {}),
  }
  const hasSplitSerial = !!(merged.identificationSerialCode || merged.identificationSerialNumber)
  const rows: { label: string; value: string; ltr?: boolean }[] = []
  const used = new Set<string>()
  for (const f of IDENTITY_FIELD_ORDER) {
    used.add(f.key)
    if (f.key === 'idSerial' && hasSplitSerial) continue   // از تکرارِ سری/سریال جلوگیری کن
    const v = fmt(f.key, merged[f.key])
    if (v) rows.push({ label: f.label, value: v, ltr: f.ltr })
  }
  // فیلدهای اضافهٔ raw که در فهرستِ بالا نبودند (تا هیچ فیلدی جا نماند)
  if (raw) {
    for (const k of Object.keys(raw)) {
      if (used.has(k) || HIDDEN.has(k)) continue
      const v = fmt(k, (raw as any)[k])
      if (v && v.length < 80) { rows.push({ label: EXTRA_LABELS[k] || k, value: v }); used.add(k) }
    }
  }
  return rows
}
