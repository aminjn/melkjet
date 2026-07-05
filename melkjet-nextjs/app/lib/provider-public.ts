import { getAccount, dashForRole } from './account-store'
import { getProfile } from './profile-store'
import { getAdvisor } from './advisor-store'
import { listItems } from './scraper-store'
import { computeRepBadges } from './reputation'
import { ensureProviderSlug, phoneForProviderSlug } from './provider-slug-store'

// نوعِ URLِ متخصص ↔ برچسبِ فارسی. فقط نقش‌های «عرضه‌کنندهٔ خدمت» صفحهٔ عمومی دارند.
const TYPE_LABEL: Record<string, string> = {
  pros: 'مشاور املاک', agency: 'آژانس املاک', builder: 'سازنده', architect: 'معمار و طراح داخلی',
  contractor: 'پیمانکار', materials: 'تأمین‌کنندهٔ مصالح', legal: 'وکیل', lawfirm: 'دفتر حقوقی',
  finance: 'بانک و بیمه', appraiser: 'کارشناس رسمی', notary: 'دفترخانه',
}
export const PROVIDER_TYPES = Object.keys(TYPE_LABEL)
export function typeLabel(t: string) { return TYPE_LABEL[t] || 'متخصص' }
export function urlTypeForRole(role?: string): string | null { const d = String(dashForRole(role || '') || '').replace('/', ''); return PROVIDER_TYPES.includes(d) ? d : null }

export interface ProviderPublic {
  phone: string; type: string; typeLabel: string; slug: string
  name: string; photo: string; bio: string; city: string; specialties: string[]
  badges: { id: string; label: string; icon: string; desc?: string }[]
  listings: { id: string; title: string; price?: string; location?: string; image?: string }[]
  hasPhone: boolean
}

export async function getProviderPublic(phone: string): Promise<ProviderPublic | null> {
  const acc = getAccount(phone); if (!acc) return null
  const type = urlTypeForRole(acc.role); if (!type) return null
  const gp = getProfile(phone)
  let name = (gp.businessName || gp.displayName || acc.name || '').trim()
  let photo = gp.logo || ''; let bio = gp.about || gp.tagline || ''; let city = gp.city || ''
  let specialties = Array.isArray(gp.specialties) ? gp.specialties : []
  try { const ap = (await getAdvisor(phone)).profile; if (ap) { if (!name && ap.name) name = ap.name.trim(); if (!photo && ap.photo) photo = ap.photo; if (!bio && (ap as any).bio) bio = (ap as any).bio; if (!city && ap.areas) city = ap.areas; if (!specialties.length && Array.isArray(ap.specialties)) specialties = ap.specialties } } catch {}
  if (!name) return null
  const mine = (await listItems('listing', { publicOnly: true })).filter(it => String(it.meta?.__ownerPhone || '') === phone)
  const soldCount = mine.filter(it => { const ds = String(it.meta?.__dealStatus || ''); return ds === 'sold' || ds === 'rented' }).length
  const badges = computeRepBadges({ createdAt: acc.createdAt, listingCount: mine.length, soldCount, profileComplete: !!(name && (photo || specialties.length) && (gp.contactPhone || gp.landline)), responsive: !!(gp.contactPhone || gp.landline) })
  const slug = await ensureProviderSlug(phone, name)
  return { phone, type, typeLabel: typeLabel(type), slug, name, photo, bio, city, specialties, badges, listings: mine.slice(0, 12).map(it => ({ id: it.id, title: it.title, price: it.price, location: it.location, image: it.image })), hasPhone: !!(gp.contactPhone || gp.landline) }
}

// resolve یک صفحهٔ عمومی: /{type}/{slug} → دادهٔ متخصص (و بررسیِ تطابقِ نوع).
export async function resolveProvider(type: string, slug: string): Promise<ProviderPublic | null> {
  const phone = await phoneForProviderSlug(slug); if (!phone) return null
  const p = await getProviderPublic(phone); if (!p) return null
  return p   // نوعِ درست را صفحه بررسی/ریدایرکت می‌کند
}
