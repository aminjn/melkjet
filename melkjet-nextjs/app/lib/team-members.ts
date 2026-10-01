import { listAgencyMembers } from './agency-link-store'
import { getAdvisor } from './advisor-store'
import { getProfile } from './profile-store'
import { listSiteHeads } from './sites-store'

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
  try { const s = (await listSiteHeads()).find(s => s.owner === phone); return s?.slug || '' } catch { return '' }
}

// ── فاز ۲۹۷ج — تیمِ آژانس‌های اسکرپی: مشاورانِ graduateشدهٔ رُستر ───────────────────
// آژانس‌های رُستری هیچ رکوردی در agency-link-store (رابطهٔ رسمیِ مشاور↔آژانس) ندارند —
// برای همین بلوکِ «مشاوران ما» در سایتِ خودکارشان همیشه خالی بود. وقتی رابطهٔ رسمی خالی
// است، مشاورانِ حساب‌دارِ (phone‌دار) اسکرپِ همان آژانس تیم را می‌سازند.
// کش با TTL تا رندرِ سایتِ هر آژانس همهٔ ردیف‌های رُستر را دوباره نخواند.
let rosterTeam297: { at: number; map: Map<string, { phone: string; name: string }[]> } | null = null
async function rosterMembersOf(agencyPhone: string): Promise<{ phone: string; name: string }[]> {
  if (!rosterTeam297 || Date.now() - rosterTeam297.at > 120_000) {
    const map = new Map<string, { phone: string; name: string }[]>()
    try {
      const { listScrapes } = await import('./agency-roster-store')
      for (const sc of await listScrapes()) {
        const members = (sc.advisors || []).filter(a => a.phone).map(a => ({ phone: String(a.phone), name: a.name || '' }))
        if (!members.length) continue
        // کلیدِ آژانس: شمارهٔ حسابِ آژانس (پس از graduate) — agencyOwner یا agencyPhone
        for (const key of [sc.agencyPhone, sc.agencyOwner]) {
          const k = String(key || '').trim()
          if (!/^\d{6,}$/.test(k)) continue   // هنوز کلیدِ موقتِ agency:slug است — حسابی ندارد
          const prev = map.get(k) || []
          for (const m of members) if (m.phone !== k && !prev.some(p => p.phone === m.phone)) prev.push(m)
          map.set(k, prev)
        }
      }
    } catch { /* رُستر در دسترس نیست — تیم از رابطهٔ رسمی می‌آید */ }
    rosterTeam297 = { at: Date.now(), map }
  }
  return rosterTeam297.map.get(agencyPhone) || []
}

// غنی‌سازیِ یک عضو با پروفایلِ مشاور + پروفایلِ کسب‌وکار + سایتِ شخصی‌اش.
async function enrichMember(phone: string, fallbackName: string): Promise<TeamMember> {
  let name = fallbackName || '', photo = '', title = '', areas = '', experience = '', specialties: string[] = [], activeListings = 0
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
}

// اعضای تیمِ یک آژانس با اطلاعاتِ کاملشان: اول رابطهٔ رسمیِ مشاور↔آژانس؛ اگر خالی بود
// (آژانسِ اسکرپی)، مشاورانِ graduateشدهٔ رُسترِ همان آژانس.
export async function getTeamMembers(agencyPhone: string): Promise<TeamMember[]> {
  if (!agencyPhone) return []
  const formal = await listAgencyMembers(agencyPhone)
  if (formal.length) return Promise.all(formal.map(m => enrichMember(m.advisorPhone, m.advisorName || '')))
  const roster = await rosterMembersOf(agencyPhone)
  return Promise.all(roster.slice(0, 40).map(m => enrichMember(m.phone, m.name)))
}
