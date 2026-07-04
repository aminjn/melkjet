import { listAgencyMembers } from './agency-link-store'
import { getAdvisor } from './advisor-store'
import { getProfile } from './profile-store'
import { listSites } from './sites-store'

// اطلاعاتِ کاملِ یک عضوِ تیمِ آژانس برای نمایش در سایت‌ساز و سایتِ منتشرشده.
export interface TeamMember {
  phone: string
  name: string
  photo: string
  title: string          // تخصص/سمت
  specialties: string[]  // تخصص‌ها
  areas: string          // مناطقِ کاری
  experience: string     // سابقه
  activeListings: number // آگهیِ فعال
  slug: string           // آدرسِ سایتِ شخصیِ مشاور (از سایت‌ساز)
}

// آدرسِ سایتِ منتشرشدهٔ خودِ مشاور (در صورتِ وجود) — منبعِ واقعی به‌جای slugِ دستی در پروفایل.
async function siteSlugFor(phone: string): Promise<string> {
  if (!phone) return ''
  try { const s = (await listSites()).find(s => s.owner === phone); return s?.slug || '' } catch { return '' }
}

// اعضای تیمِ یک آژانس را با اطلاعاتِ کاملشان برمی‌گرداند (از رابطهٔ واقعیِ مشاور↔آژانس).
export async function getTeamMembers(agencyPhone: string): Promise<TeamMember[]> {
  if (!agencyPhone) return []
  return Promise.all((await listAgencyMembers(agencyPhone)).map(async m => {
    const phone = m.advisorPhone
    let name = m.advisorName || '', photo = '', title = '', areas = '', experience = '', specialties: string[] = [], activeListings = 0
    try {
      const ad = await getAdvisor(phone)
      const pr = ad.profile
      if (pr) {
        if (pr.name) name = pr.name
        if (pr.photo) photo = pr.photo
        if (pr.title) title = pr.title
        if (pr.areas) areas = pr.areas
        if (pr.experience) experience = pr.experience
        if (Array.isArray(pr.specialties)) specialties = pr.specialties.filter(Boolean)
      }
      activeListings = (ad.listings || []).filter(l => l.status === 'active').length
    } catch {}
    // جایگزین از پروفایلِ کسب‌وکار
    const prof = getProfile(phone)
    if (!photo) photo = prof.logo || ''
    if (!title) title = prof.businessType || prof.tagline || ''
    if (!areas && Array.isArray(prof.areas) && prof.areas.length) areas = prof.areas.join('، ')
    if (!specialties.length && Array.isArray(prof.specialties) && prof.specialties.length) specialties = prof.specialties
    return { phone, name: name || 'مشاور', photo, title, specialties: specialties.slice(0, 6), areas, experience, activeListings, slug: await siteSlugFor(phone) }
  }))
}
