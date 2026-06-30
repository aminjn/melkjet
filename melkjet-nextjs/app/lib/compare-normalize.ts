import { publicProject, regionLabel, phaseLabel } from './persiansaze-store'
import { getPublic, findManual, STATUS_LABEL } from './builder-public-store'
import { getProfile } from './persiansaze-store'
import { getItemById } from './scraper-store'

// شکلِ یکسانِ یک موردِ مقایسه (آگهی یا پروژه) با ردیف‌های مشخصات.
export interface CompareItem {
  kind: 'project' | 'item'
  id: string
  title: string
  subtitle: string
  photo: string
  href: string
  specs: { label: string; value: string }[]
}

const faNum = (n: number) => (Number(n) || 0).toLocaleString('fa-IR')

function projectCompare(id: string): CompareItem | null {
  const ps = publicProject(id)
  if (ps) {
    const p = ps.project, b = ps.builder
    const meta = getPublic(b.id).projMeta?.[id] || {}
    const photos = (p.photos && p.photos.length) ? p.photos : (p.photo?.imageUrl ? [p.photo.imageUrl] : (p.photo?.imageThumbnailUrl ? [p.photo.imageThumbnailUrl] : []))
    const totalFloors = Number(meta.floors ?? p.floors) || 0, subFloors = Number(p.subFloors) || 0
    const aboveGround = subFloors > 0 && subFloors < totalFloors ? totalFloors - subFloors : totalFloors
    const specs = [
      { label: 'منطقه', value: regionLabel(p) || '—' },
      { label: 'متراژ زمین', value: p.groundArea ? `${faNum(p.groundArea)} م²` : '—' },
      { label: 'زیربنا', value: p.residentialArea ? `${faNum(p.residentialArea)} م²` : '—' },
      { label: 'طبقات', value: aboveGround ? faNum(aboveGround) : '—' },
      { label: 'تعداد واحد', value: p.units ? faNum(Number(meta.units ?? p.units)) : '—' },
      { label: 'مرحلهٔ ساخت', value: (meta.stage || phaseLabel(p)) || '—' },
      { label: 'قیمت', value: meta.priceText || '—' },
      { label: 'سازنده', value: b.name || '—' },
    ]
    return { kind: 'project', id, title: p.address || 'پروژه', subtitle: regionLabel(p), photo: photos[0] || '', href: `/proje/${id}`, specs }
  }
  const man = findManual(id)
  if (man) {
    const m = man.project; const prof = getProfile(man.builderId)
    const specs = [
      { label: 'منطقه', value: m.location || '—' },
      { label: 'زیربنا/متراژ', value: m.areaRange || '—' },
      { label: 'طبقات', value: m.floors ? faNum(m.floors) : '—' },
      { label: 'تعداد واحد', value: m.units ? faNum(m.units) : '—' },
      { label: 'مرحلهٔ ساخت', value: m.stage || STATUS_LABEL[m.status] || '—' },
      { label: 'قیمت', value: m.priceText || '—' },
      { label: 'سازنده', value: prof?.name || '—' },
    ]
    return { kind: 'project', id, title: m.name, subtitle: m.location || '', photo: (m.photos && m.photos[0]) || '', href: `/proje/${id}`, specs }
  }
  return null
}

function itemCompare(id: string): CompareItem | null {
  const it = getItemById(id)
  if (!it) return null
  const specs: { label: string; value: string }[] = []
  if (it.price) specs.push({ label: 'قیمت', value: it.price })
  if (it.location) specs.push({ label: 'موقعیت', value: it.location })
  // هر متادیتای واقعیِ آگهی (متراژ/خواب/سال/…) به‌صورتِ ردیف.
  for (const [k, v] of Object.entries(it.meta || {})) {
    if (!v || k.startsWith('__') || ['شهر', 'محله'].includes(k)) continue
    specs.push({ label: k, value: String(v) })
  }
  return { kind: 'item', id, title: it.title, subtitle: it.location || '', photo: it.image || '', href: `/property/${id}`, specs }
}

export function normalizeForCompare(kind: string, id: string): CompareItem | null {
  return kind === 'project' ? projectCompare(id) : itemCompare(id)
}
