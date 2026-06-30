import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import { publicProject, publicQuery, regionLabel, phaseLabel } from '../../lib/persiansaze-store'
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

export default async function ProjectPage({ params }: { params: Promise<{ hashId: string }> }) {
  const { hashId } = await params
  const data = publicProject(hashId)

  if (!data) {
    return (
      <>
        <Nav />
        <main style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>پروژه پیدا نشد</main>
        <Footer />
      </>
    )
  }
  const { project: p, builder, others } = data
  const region = regionLabel(p)
  const phase = phaseLabel(p)
  const idx = ladderIdx(phase)
  const progress = Math.round((idx / (LADDER.length - 1)) * 100)
  const milestones = LADDER.map((name, i) => ({ name, done: i < idx, active: i === idx }))

  const photos: string[] = (p.photos && p.photos.length) ? p.photos : (p.photo?.imageUrl ? [p.photo.imageUrl] : (p.photo?.imageThumbnailUrl ? [p.photo.imageThumbnailUrl] : []))

  // واحدها بر طبقاتِ واقعی (مشتق از تعدادِ طبقه/واحدِ واقعی — بدونِ قیمت/خوابِ ساختگی).
  const floors = Math.max(1, Number(p.floors) || 1)
  const totalUnits = Math.max(0, Number(p.units) || 0)
  const avgArea = totalUnits ? Math.round((Number(p.residentialArea) || 0) / totalUnits) : 0
  const perFloor: { floor: number; count: number }[] = []
  if (totalUnits) {
    const counts: Record<number, number> = {}
    for (let i = 0; i < totalUnits; i++) { const fl = (i % floors) + 1; counts[fl] = (counts[fl] || 0) + 1 }
    for (let f = 1; f <= floors; f++) if (counts[f]) perFloor.push({ floor: f, count: counts[f] })
  }

  // پروژه‌های مشابه: ابتدا سایرِ پروژه‌های همین سازنده، سپس هم‌منطقه (سازندهٔ دیگر).
  const peers = publicQuery({ region, pageSize: 12 }).items.filter(x => x.hashId !== hashId && x.builderId !== builder.id)
  const similar = [
    ...others.map(o => ({ hashId: o.hashId, address: o.address || '', region: regionLabel(o), photo: o.photo?.imageThumbnailUrl || o.photo?.imageUrl || '', builderName: builder.name })),
    ...peers.map(o => ({ hashId: o.hashId, address: o.address || '', region: regionLabel(o), photo: o.photo?.imageThumbnailUrl || o.photo?.imageUrl || '', builderName: o.builderName })),
  ].slice(0, 6)

  const view = {
    hashId: p.hashId,
    title: p.address || 'پروژه',
    region,
    phase: phase || '—',
    progress,
    milestones,
    statusLabel: phase || 'در حال ساخت',
    photos,
    floors: Number(p.floors) || 0,
    subFloors: Number(p.subFloors) || 0,
    units: totalUnits,
    residentialArea: Number(p.residentialArea) || 0,
    groundArea: Number(p.groundArea) || 0,
    avgArea,
    perFloor,
    lat: p.latitude ?? null,
    lng: p.longitude ?? null,
    builder: {
      id: builder.id,
      name: builder.name || 'سازنده',
      phone: (builder.phones || [])[0] || '',
      projectCount: builder.projectCount,
      regions: (builder.regions || []).map(rid => regionLabel({ cityId: 1, regionId: rid })).filter(Boolean).slice(0, 6),
    },
    similar,
  }

  return <ProjectView p={view} />
}
