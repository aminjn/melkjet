import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import { publicProject, publicQuery, regionLabel, phaseLabel, getProfile } from '../../lib/persiansaze-store'
import { getPublic, findManual, STATUS_LABEL } from '../../lib/builder-public-store'
import ProjectView from './ProjectView'

export const dynamic = 'force-dynamic'

const LADDER = ['پی و اسکلت', 'سفت‌کاری', 'گچ و خاک', 'نازک‌کاری', 'تأسیسات', 'تحویل']
function ladderIdx(label: string): number {
  let idx = LADDER.findIndex(s => label && (label.includes(s) || s.includes(label)))
  if (idx < 0) {
    if (/اسکلت|پی|فونداسیون|گود/.test(label)) idx = 0
    else if (/سفت/.test(label)) idx = 1
    else if (/گچ|خاک/.test(label)) idx = 2
    else if (/نازک/.test(label)) idx = 3
    else if (/تأسیسات|تاسیسات|مکانیک|برق/.test(label)) idx = 4
    else if (/تحویل|نما|پایان|اتمام/.test(label)) idx = 5
    else idx = 2
  }
  return idx
}

function NotFound() {
  return (<><Nav /><main style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>پروژه پیدا نشد</main><Footer /></>)
}

export default async function ProjectPage({ params }: { params: Promise<{ hashId: string }> }) {
  const { hashId } = await params

  // ── منبعِ پروژه: پرشین سازه (با override) یا پروژهٔ دستیِ سازنده ──
  let builderId = '', builderName = 'سازنده', builderPhones: string[] = [], builderProjectCount = 0, builderRegions: number[] = []
  let title = 'پروژه', region = '', phaseRaw = '', usage: string | undefined
  let photos: string[] = [], lat: number | null = null, lng: number | null = null
  let floorsTotal = 0, subFloors = 0, units = 0, residentialArea = 0, groundArea = 0
  let enrich: any = {}, others: any[] = []

  const ps = publicProject(hashId)
  if (ps) {
    const pr = ps.project, b = ps.builder
    enrich = getPublic(b.id).projMeta?.[hashId] || {}
    builderId = b.id; builderName = b.name; builderPhones = b.phones || []; builderProjectCount = b.projectCount; builderRegions = b.regions || []
    title = pr.address || 'پروژه'; region = regionLabel(pr); phaseRaw = phaseLabel(pr)
    const psPhotos = (pr.photos && pr.photos.length) ? pr.photos : (pr.photo?.imageUrl ? [pr.photo.imageUrl] : (pr.photo?.imageThumbnailUrl ? [pr.photo.imageThumbnailUrl] : []))
    photos = [...psPhotos, ...(enrich.photos || [])]
    lat = pr.latitude ?? null; lng = pr.longitude ?? null
    floorsTotal = Number(enrich.floors ?? pr.floors) || 0; subFloors = Number(pr.subFloors) || 0
    units = Number(enrich.units ?? pr.units) || 0
    residentialArea = Number(pr.residentialArea) || 0; groundArea = Number(pr.groundArea) || 0
    others = ps.others
  } else {
    const man = findManual(hashId)
    if (!man) return <NotFound />
    const m = man.project; enrich = m
    const prof = getProfile(man.builderId)
    builderId = man.builderId; builderName = prof?.name || 'سازنده'; builderPhones = prof?.phones || []; builderProjectCount = prof?.projectCount || 0; builderRegions = prof?.regions || []
    title = m.name; region = m.location || ''; phaseRaw = m.stage || ''; usage = m.usage
    photos = m.photos || []
    floorsTotal = Number(m.floors) || 0; units = Number(m.units) || 0
    others = (prof?.projects || []).slice(0, 6)
  }

  const phase = enrich.stage || phaseRaw
  const idx = ladderIdx(phase)
  const progress = Math.round((idx / (LADDER.length - 1)) * 100)
  const milestones = LADDER.map((name, i) => ({ name, done: i < idx, active: i === idx }))

  const aboveGround = subFloors > 0 && subFloors < floorsTotal ? floorsTotal - subFloors : Math.max(0, floorsTotal)
  const avgArea = units ? Math.round(residentialArea / units) : 0
  const perFloor: { floor: number; count: number }[] = []
  if (units && aboveGround) {
    const counts: Record<number, number> = {}
    for (let i = 0; i < units; i++) { const fl = (i % aboveGround) + 1; counts[fl] = (counts[fl] || 0) + 1 }
    for (let f = 1; f <= aboveGround; f++) if (counts[f]) perFloor.push({ floor: f, count: counts[f] })
  }

  const peers = ps ? publicQuery({ region, pageSize: 12 }).items.filter(x => x.hashId !== hashId && x.builderId !== builderId) : []
  const similar = [
    ...others.map((o: any) => ({ hashId: o.hashId, address: o.address || '', region: regionLabel(o), photo: o.photo?.imageThumbnailUrl || o.photo?.imageUrl || '', builderName })),
    ...peers.map((o: any) => ({ hashId: o.hashId, address: o.address || '', region: regionLabel(o), photo: o.photo?.imageThumbnailUrl || o.photo?.imageUrl || '', builderName: o.builderName })),
  ].filter(s => s.hashId && s.hashId !== hashId).slice(0, 6)

  const statusLabel = (enrich.status && STATUS_LABEL[enrich.status as keyof typeof STATUS_LABEL]) || phase || 'در حال ساخت'

  const view = {
    hashId, title, region, phase, progress, milestones, statusLabel, photos,
    floors: aboveGround, subFloors, units, residentialArea, groundArea, avgArea, perFloor,
    lat, lng, usage,
    amenities: enrich.amenities || [], plans: enrich.plans || [],
    priceText: enrich.priceText, salesProgress: enrich.salesProgress,
    builder: { id: builderId, name: builderName, hasPhone: !!builderPhones[0], projectCount: builderProjectCount, regions: builderRegions.map(r => regionLabel({ cityId: 1, regionId: r })).filter(Boolean).slice(0, 6) },
    similar,
  }

  return <ProjectView p={view} />
}
