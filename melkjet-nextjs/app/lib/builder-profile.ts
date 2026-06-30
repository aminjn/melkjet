import { getProfile, regionLabel, phaseLabel, type PSProfile } from './persiansaze-store'
import { getPublic, reviewStats, followerCount, STATUS_LABEL, type ProjStatus, type Review } from './builder-public-store'

// ─── سرهم‌کردنِ پروفایلِ عمومیِ سازنده از دادهٔ واقعیِ پرشین سازه + ورودیِ خودِ سازنده ──

export interface ProjectCard {
  key: string; hashId?: string; manual: boolean
  name: string; location: string
  status: ProjStatus; statusLabel: string
  deliveryDate?: string; units?: number; areaRange?: string; priceText?: string
  salesProgress?: number; description?: string; photo?: string
}
export interface BuilderProfile {
  id: string; name: string; verified: boolean
  tagline: string; sinceYear: string; experienceYears: number | null
  about: string; website: string; officeAddress: string; phone: string
  tags: string[]; activeRegionsText: string
  followers: number; rating: number; reviewsCount: number; unitsDelivered: number; activeCount: number
  current: ProjectCard[]; past: ProjectCard[]; reviews: Review[]
}

function currentFaYear(): number {
  try { return Number(new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { year: 'numeric' }).format(new Date())) || 1405 } catch { return 1405 }
}

// مرحلهٔ پرشین سازه را به وضعیتِ نمایشِ عمومی نگاشت می‌کند.
function statusFromPhase(label: string): ProjStatus {
  if (/تحویل|پایان|اتمام|آماده/.test(label)) return 'delivered'
  return 'building'
}

function projCard(pr: any, meta: any, builderName: string): ProjectCard {
  const phase = phaseLabel(pr)
  const status: ProjStatus = meta?.status || statusFromPhase(phase)
  const photo = (pr.photos && pr.photos[0]) || pr.photo?.imageThumbnailUrl || pr.photo?.imageUrl || ''
  const areaRange = meta?.areaRange || (pr.residentialArea && pr.units ? `~${Math.round(pr.residentialArea / pr.units)} م²` : (pr.residentialArea ? `${pr.residentialArea} م²` : ''))
  return {
    key: pr.hashId, hashId: pr.hashId, manual: false,
    name: pr.address || 'پروژه', location: regionLabel(pr) || '',
    status, statusLabel: STATUS_LABEL[status],
    deliveryDate: meta?.deliveryDate, units: Number(pr.units) || undefined, areaRange,
    priceText: meta?.priceText, salesProgress: meta?.salesProgress,
    description: meta?.description, photo,
  }
}

export function assembleBuilderProfile(id: string): BuilderProfile | null {
  const prof: PSProfile | null = getProfile(id)
  if (!prof) return null
  const pub = getPublic(id)
  const meta = pub.projMeta || {}

  const psCards = (prof.projects || [])
    .filter(pr => meta[pr.hashId]?.published !== false)
    .map(pr => ({ card: projCard(pr, meta[pr.hashId], prof.name), isPast: meta[pr.hashId]?.isPast ?? (projCard(pr, meta[pr.hashId], prof.name).status === 'delivered') }))

  const manualCards = (pub.manual || [])
    .filter(m => m.published !== false)
    .map(m => ({
      card: {
        key: m.id, hashId: m.id, manual: true, name: m.name, location: m.location,
        status: m.status, statusLabel: STATUS_LABEL[m.status],
        deliveryDate: m.deliveryDate, units: m.units, areaRange: m.areaRange, priceText: m.priceText,
        salesProgress: m.salesProgress, description: m.description, photo: (m.photos && m.photos[0]) || '',
      } as ProjectCard,
      isPast: m.isPast ?? (m.status === 'delivered'),
    }))

  const all = [...psCards, ...manualCards]
  const current = all.filter(x => !x.isPast).map(x => x.card)
  const past = all.filter(x => x.isPast).map(x => x.card)
  const unitsDelivered = past.reduce((s, c) => s + (Number(c.units) || 0), 0)

  const rs = reviewStats(id)
  const since = (pub.sinceYear || '').replace(/\D/g, '')
  const experienceYears = since ? Math.max(0, currentFaYear() - Number(since)) : null

  const regionsText = pub.activeRegionsText || (prof.regions || []).map(r => regionLabel({ cityId: 1, regionId: r })).filter(Boolean).slice(0, 4).join('، ')

  return {
    // «تأییدشده» = یا ادمین تأیید کرده، یا سازندهٔ واقعیِ ثبت‌شده با شمارهٔ تأییدشده در پایگاه است.
    id, name: prof.name || 'سازنده', verified: pub.verified ?? ((prof.phones || []).length > 0),
    tagline: pub.tagline || '', sinceYear: pub.sinceYear || '', experienceYears,
    about: pub.about || '', website: pub.website || '', officeAddress: pub.officeAddress || '',
    phone: pub.phonePublic || (prof.phones || [])[0] || '',
    tags: pub.tags || [], activeRegionsText: regionsText,
    followers: followerCount(id), rating: rs.avg, reviewsCount: rs.count,
    unitsDelivered, activeCount: current.length,
    current, past, reviews: pub.reviews || [],
  }
}
