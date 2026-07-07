// REOS v4 · Market Knowledge Graph — گرافِ بازار-محور: منطقه ↔ ملک ↔ مشاور/سازنده.
// «فعال‌ترین مشاورِ سعادت‌آباد؟» را با یال‌های located_in/active_in پاسخ می‌دهد.
import { candidateListings } from '../scraper-store'
import { upsertNodes, addEdge, neighbors, getNode } from './graph'

const areaOf = (it: { meta?: Record<string, string>; location?: string }) => {
  const m = it.meta || {}
  return [String(m['شهر'] || '').trim(), String(m['محله'] || it.location || '').trim()].filter(Boolean).join('|')
}

// ساختِ گرافِ بازار از آگهی‌ها: ملک→located_in→منطقه، مالک/مشاور→active_in→منطقه (وزن = تعدادِ آگهی).
export async function syncMarketGraph(limit = 800): Promise<{ areas: number; edges: number }> {
  const items = await candidateListings(limit)
  const nodes = new Map<string, { id: string; type: 'area' | 'property' | 'agent'; label?: string }>()
  const edges: { from: string; to: string; rel: 'located_in' | 'active_in'; w: number }[] = []
  const areas = new Set<string>()
  for (const it of items) {
    const area = areaOf(it); if (!area) continue
    areas.add(area)
    const aid = 'area:' + area
    nodes.set(aid, { id: aid, type: 'area', label: area })
    nodes.set('p:' + it.id, { id: 'p:' + it.id, type: 'property', label: it.title })
    edges.push({ from: 'p:' + it.id, to: aid, rel: 'located_in', w: 1 })
    const owner = (it as { ownerId?: string; owner?: string }).ownerId
    if (owner) { nodes.set('o:' + owner, { id: 'o:' + owner, type: 'agent', label: (it as { owner?: string }).owner || owner }); edges.push({ from: 'o:' + owner, to: aid, rel: 'active_in', w: 1 }) }
  }
  await upsertNodes(Array.from(nodes.values()))
  for (const e of edges) await addEdge(e.from, e.to, e.rel, e.w)
  return { areas: areas.size, edges: edges.length }
}

// فعال‌ترین مشاوران/مالکانِ یک منطقه (بیشترین آگهیِ همان منطقه).
export async function topActiveInArea(area: string, k = 10): Promise<{ id: string; label?: string; listings: number }[]> {
  const aid = 'area:' + area
  const es = await neighbors(aid, { rel: 'active_in', dir: 'in', limit: 100 })
  const out = await Promise.all(es.slice(0, k).map(async e => {
    const n = await getNode(e.from).catch(() => null)
    return { id: e.from.replace(/^o:/, ''), label: n?.label, listings: e.weight }
  }))
  return out.sort((a, b) => b.listings - a.listings)
}

// شمارِ املاکِ ثبت‌شده در یک منطقه (از یال‌های located_in).
export async function areaListingCount(area: string): Promise<number> {
  const es = await neighbors('area:' + area, { rel: 'located_in', dir: 'in', limit: 1000 })
  return es.length
}
