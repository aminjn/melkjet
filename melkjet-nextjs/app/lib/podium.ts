import { getAdminData } from './admin-store'
import { shecanRequest } from './shecan-https'

// Pod.ir / پادیوم → استعلامِ ثبت‌احوال + تطبیقِ شاهکار (موبایل ↔ کد ملی).
// کلیدها از env یا از admin-data.podium خوانده می‌شوند (هیچ کلیدی در کد نیست).
// تماس‌ها از DNS شکنِ داخلِ برنامه می‌گذرند (مثلِ نشان/گپ) چون api.pod.ir داخلی است.

function cfg() {
  const p = getAdminData().podium || ({} as any)
  const v = (envKey: string, stored?: string) => (process.env[envKey] && String(process.env[envKey]).trim()) || (stored && String(stored).trim()) || ''
  return {
    url: v('PODIUM_URL', p.url) || 'https://api.pod.ir/srv/sc2/consumers/services/do',
    token: v('PODIUM_TOKEN', p.token),
    idKey: v('GET_IDENTITY_INFO_API_KEY', p.idKey),
    matchKey: v('MATCH_NATIONAL_ID_AND_PHONE_NUMBER_API_KEY', p.matchKey),
    idProduct: v('POD_IDENTITY_PRODUCT_ID', p.idProduct) || '46659320',
    matchProduct: v('POD_MATCH_PRODUCT_ID', p.matchProduct) || '46645324',
  }
}

export function podConfigured(): boolean { const c = cfg(); return Boolean(c.token && c.idKey && c.matchKey) }
export function podMissing(): string[] {
  const c = cfg(); const m: string[] = []
  if (!c.token) m.push('PODIUM_TOKEN')
  if (!c.idKey) m.push('GET_IDENTITY_INFO_API_KEY')
  if (!c.matchKey) m.push('MATCH_NATIONAL_ID_AND_PHONE_NUMBER_API_KEY')
  return m
}

async function callPodium(payload: unknown): Promise<{ hasError?: boolean; message?: string; result?: string }> {
  const c = cfg()
  const res = await shecanRequest(c.url, {
    method: 'POST',
    headers: { Authorization: `bearer ${c.token}`, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
    timeout: 25000,
  })
  try { return JSON.parse(res.body) } catch { return { hasError: true, message: `پاسخِ نامعتبر از پاد (HTTP ${res.status})` } }
}

export interface Identity {
  nationalCode: string; firstName: string; lastName: string
  fatherName?: string; gender?: string; birthPlace?: string; birthDate?: string
  raw?: Record<string, unknown>
}

// استعلامِ ثبت‌احوال: کد ملی + تاریخ تولدِ شمسیِ ۸ رقمی (YYYYMMDD)
export async function getIdentity(nationalCode: string, jBirthDate: string): Promise<{ ok: boolean; identity?: Identity; error?: string }> {
  if (!podConfigured()) return { ok: false, error: 'POD_NOT_CONFIGURED' }
  try {
    const data = await callPodium({ productEntityId: Number(cfg().idProduct), apiKey: cfg().idKey, providerParameters: { nationalCode, birthDate: jBirthDate } })
    if (data.hasError || !data.result) return { ok: false, error: data.message || 'سرویس استعلام در دسترس نیست.' }
    const parsed: any = JSON.parse(data.result)
    if (!parsed || !parsed.identityInfo) return { ok: false, error: (parsed && parsed.message) || 'کد ملی یا تاریخ تولد نادرست است.' }
    if (parsed.identityInfo.alive === false) return { ok: false, error: 'شخصِ موردنظر در سامانه فوت‌شده ثبت شده است.' }
    const i = parsed.identityInfo
    return {
      ok: true,
      identity: {
        nationalCode: String(i.nationalCode || nationalCode),
        firstName: i.firstName || '', lastName: i.lastName || '',
        fatherName: i.fatherName || '', gender: String(i.gender || '').toLowerCase(),
        birthPlace: i.birthPlace || '', birthDate: String(i.birthDate || jBirthDate || ''),
        raw: i as Record<string, unknown>,
      },
    }
  } catch (e: any) { return { ok: false, error: e?.message || 'IDENTITY_FETCH_ERROR' } }
}

// تطبیقِ شاهکار: آیا این موبایل به نامِ این کد ملی است؟
export async function shahkarMatch(nationalCode: string, mobileNumber: string): Promise<{ ok: boolean; matched: boolean; error?: string }> {
  if (!podConfigured()) return { ok: false, matched: false, error: 'POD_NOT_CONFIGURED' }
  try {
    const data = await callPodium({ productEntityId: cfg().matchProduct, apiKey: cfg().matchKey, providerParameters: { body: { nationalCode, mobileNumber } } })
    if (!data.result) return { ok: false, matched: false, error: data.message || 'سرویس شاهکار پاسخ نداد.' }
    const parsed: any = JSON.parse(data.result)
    return { ok: true, matched: Boolean(parsed && parsed.matched) }
  } catch (e: any) { return { ok: false, matched: false, error: e?.message || 'MATCH_FETCH_ERROR' } }
}

// چک‌سامِ کد ملیِ ایران (اعتبارسنجیِ آفلاین)
export function isValidNationalId(input: string): boolean {
  let code = String(input)
  const L = code.length
  if (L < 8 || parseInt(code, 10) === 0) return false
  code = ('0000' + code).substr(L + 4 - 10)
  if (parseInt(code.substr(3, 6), 10) === 0) return false
  const c = parseInt(code.substr(9, 1), 10)
  let s = 0
  for (let i = 0; i < 9; i++) s += parseInt(code.substr(i, 1), 10) * (10 - i)
  s = s % 11
  return (s < 2 && c === s) || (s >= 2 && c === 11 - s)
}
