// REOS v2 · Knowledge Graph — گرافِ موجودیت‌ها با یال‌های نوع‌دار + پیمایشِ BFS.
// buyer→property→agent→builder→lawyer→bank→notary→contractor. Dual-mode PG/file.
// از رویدادهای واقعی پر می‌شود (viewed/saved/contacted/assigned)؛ پایهٔ توصیه/تحلیلِ شبکه‌ای.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, pgTx } from '../db'
import { recentEvents } from './store'

export type NodeType = 'user' | 'property' | 'agent' | 'agency' | 'builder' | 'lead' | 'deal' | 'lawyer' | 'bank' | 'notary' | 'contractor' | 'appraiser' | 'materials' | 'architect' | 'area'
export type EdgeRel = 'viewed' | 'saved' | 'contacted' | 'owns' | 'listed' | 'assigned' | 'represents' | 'built' | 'financed' | 'notarized' | 'appraised' | 'referred' | 'about' | 'located_in' | 'active_in'
export interface GNode { id: string; type: NodeType; label?: string; meta?: Record<string, unknown>; at: number }
export interface GEdge { from: string; to: string; rel: EdgeRel; weight: number; at: number }

const N_FILE = join(process.cwd(), '.reos-graph-nodes.json')
const E_FILE = join(process.cwd(), '.reos-graph-edges.json')
function fileLoad<T>(f: string, fb: T): T { if (existsSync(f)) { try { return JSON.parse(readFileSync(f, 'utf-8')) } catch {} } return fb }
function fileSave(f: string, d: unknown): void { try { writeFileSync(f, JSON.stringify(d)) } catch {} }
const ekey = (e: { from: string; to: string; rel: string }) => `${e.from}|${e.to}|${e.rel}`

let ready = false
async function ensure(): Promise<void> {
  if (ready) return
  await pgTx(async c => {
    await c.query(`CREATE TABLE IF NOT EXISTS reos_graph_nodes (
      id text PRIMARY KEY, type text NOT NULL, label text, meta jsonb NOT NULL DEFAULT '{}'::jsonb, at bigint NOT NULL )`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_graph_nodes_type ON reos_graph_nodes(type)`)
    await c.query(`CREATE TABLE IF NOT EXISTS reos_graph_edges (
      from_id text NOT NULL, to_id text NOT NULL, rel text NOT NULL, weight double precision NOT NULL DEFAULT 1,
      at bigint NOT NULL, PRIMARY KEY (from_id, to_id, rel) )`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_graph_edges_from ON reos_graph_edges(from_id)`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_graph_edges_to ON reos_graph_edges(to_id)`)
  })
  ready = true
}

export async function upsertNode(n: Omit<GNode, 'at'> & { at?: number }): Promise<void> { await upsertNodes([n]) }
export async function upsertNodes(nodes: (Omit<GNode, 'at'> & { at?: number })[]): Promise<void> {
  if (!nodes.length) return
  const now = Date.now()
  if (pgEnabled()) {
    await ensure()
    const cols = 5, values: string[] = [], params: unknown[] = []
    nodes.forEach((n, i) => { const b = i * cols; values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`); params.push(n.id, n.type, n.label || null, JSON.stringify(n.meta || {}), n.at || now) })
    await pgTx(c => c.query(`INSERT INTO reos_graph_nodes(id,type,label,meta,at) VALUES ${values.join(',')}
      ON CONFLICT(id) DO UPDATE SET type=EXCLUDED.type, label=COALESCE(EXCLUDED.label, reos_graph_nodes.label), meta=EXCLUDED.meta`, params))
  } else {
    const db = fileLoad<Record<string, GNode>>(N_FILE, {})
    for (const n of nodes) db[n.id] = { id: n.id, type: n.type, label: n.label, meta: n.meta || {}, at: n.at || now }
    fileSave(N_FILE, db)
  }
}

// افزودن یال (وزن انباشته می‌شود؛ تکرارِ تعامل = یالِ قوی‌تر).
export async function addEdge(from: string, to: string, rel: EdgeRel, weight = 1): Promise<void> {
  const now = Date.now()
  if (pgEnabled()) {
    await ensure()
    await pgTx(c => c.query(`INSERT INTO reos_graph_edges(from_id,to_id,rel,weight,at) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(from_id,to_id,rel) DO UPDATE SET weight=reos_graph_edges.weight+EXCLUDED.weight, at=EXCLUDED.at`, [from, to, rel, weight, now]))
  } else {
    const db = fileLoad<Record<string, GEdge>>(E_FILE, {})
    const k = ekey({ from, to, rel }); const cur = db[k]
    db[k] = { from, to, rel, weight: (cur?.weight || 0) + weight, at: now }; fileSave(E_FILE, db)
  }
}

export async function getNode(id: string): Promise<GNode | null> {
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`SELECT * FROM reos_graph_nodes WHERE id=$1`, [id]))
    const x = r.rows[0]; return x ? { id: x.id, type: x.type, label: x.label || undefined, meta: x.meta || {}, at: Number(x.at) } : null
  }
  return fileLoad<Record<string, GNode>>(N_FILE, {})[id] || null
}

// همسایه‌ها (یال‌های خروجی/ورودی/هردو).
export async function neighbors(id: string, opts: { rel?: EdgeRel; dir?: 'out' | 'in' | 'both'; limit?: number } = {}): Promise<GEdge[]> {
  const dir = opts.dir || 'both', limit = Math.min(opts.limit ?? 100, 1000)
  if (pgEnabled()) {
    await ensure()
    const cond: string[] = [], params: unknown[] = []
    if (dir === 'out') { params.push(id); cond.push(`from_id=$${params.length}`) }
    else if (dir === 'in') { params.push(id); cond.push(`to_id=$${params.length}`) }
    else { params.push(id); cond.push(`(from_id=$${params.length} OR to_id=$${params.length})`) }
    if (opts.rel) { params.push(opts.rel); cond.push(`rel=$${params.length}`) }
    params.push(limit)
    const r = await pgTx(c => c.query(`SELECT from_id,to_id,rel,weight,at FROM reos_graph_edges WHERE ${cond.join(' AND ')} ORDER BY weight DESC LIMIT $${params.length}`, params))
    return r.rows.map(x => ({ from: x.from_id, to: x.to_id, rel: x.rel, weight: Number(x.weight), at: Number(x.at) }))
  }
  const all = Object.values(fileLoad<Record<string, GEdge>>(E_FILE, {}))
  return all.filter(e => (dir === 'out' ? e.from === id : dir === 'in' ? e.to === id : e.from === id || e.to === id) && (!opts.rel || e.rel === opts.rel))
    .sort((a, b) => b.weight - a.weight).slice(0, limit)
}

// زیرگراف تا عمقِ معین (BFS) — برای نمایش/تحلیلِ اطرافِ یک موجودیت.
export async function subgraph(id: string, depth = 2, cap = 60): Promise<{ nodes: GNode[]; edges: GEdge[] }> {
  const seen = new Set<string>([id]); const edgeSet = new Map<string, GEdge>()
  let frontier = [id]
  for (let d = 0; d < depth && seen.size < cap; d++) {
    const next: string[] = []
    for (const n of frontier) {
      const es = await neighbors(n, { limit: 25 })
      for (const e of es) { edgeSet.set(ekey(e), e); const other = e.from === n ? e.to : e.from; if (!seen.has(other) && seen.size < cap) { seen.add(other); next.push(other) } }
    }
    frontier = next
  }
  const nodes = (await Promise.all(Array.from(seen).map(getNode))).filter(Boolean) as GNode[]
  return { nodes, edges: Array.from(edgeSet.values()) }
}

// کوتاه‌ترین مسیرِ بینِ دو موجودیت (BFS) — «چطور این خریدار به آن سازنده وصل است؟».
export async function shortestPath(from: string, to: string, maxDepth = 5): Promise<string[] | null> {
  if (from === to) return [from]
  const prev = new Map<string, string>([[from, '']]); let frontier = [from]
  for (let d = 0; d < maxDepth; d++) {
    const next: string[] = []
    for (const n of frontier) {
      for (const e of await neighbors(n, { limit: 50 })) {
        const other = e.from === n ? e.to : e.from
        if (!prev.has(other)) { prev.set(other, n); if (other === to) { const path = [to]; let c = to; while (prev.get(c)) { c = prev.get(c)!; path.unshift(c) } return path } next.push(other) }
      }
    }
    frontier = next
    if (!frontier.length) break
  }
  return null
}

export async function graphStats(): Promise<{ nodes: number; edges: number; byType: Record<string, number>; byRel: Record<string, number> }> {
  if (pgEnabled()) {
    await ensure()
    const [nc, ec, nt, er] = await Promise.all([
      pgTx(c => c.query(`SELECT count(*)::int n FROM reos_graph_nodes`)),
      pgTx(c => c.query(`SELECT count(*)::int n FROM reos_graph_edges`)),
      pgTx(c => c.query(`SELECT type, count(*)::int n FROM reos_graph_nodes GROUP BY type`)),
      pgTx(c => c.query(`SELECT rel, count(*)::int n FROM reos_graph_edges GROUP BY rel`)),
    ])
    const byType: Record<string, number> = {}, byRel: Record<string, number> = {}
    nt.rows.forEach(r => byType[r.type] = r.n); er.rows.forEach(r => byRel[r.rel] = r.n)
    return { nodes: nc.rows[0].n, edges: ec.rows[0].n, byType, byRel }
  }
  const nodes = fileLoad<Record<string, GNode>>(N_FILE, {}), edges = fileLoad<Record<string, GEdge>>(E_FILE, {})
  const byType: Record<string, number> = {}, byRel: Record<string, number> = {}
  Object.values(nodes).forEach(n => byType[n.type] = (byType[n.type] || 0) + 1)
  Object.values(edges).forEach(e => byRel[e.rel] = (byRel[e.rel] || 0) + 1)
  return { nodes: Object.keys(nodes).length, edges: Object.keys(edges).length, byType, byRel }
}

// ── پرکردنِ گراف از رویدادهای واقعی (Data → Graph) ──
const EVENT_REL: Record<string, EdgeRel> = { user_clicked_property: 'viewed', user_saved_property: 'saved', contact_made: 'contacted' }
export async function syncGraphFromEvents(limit = 3000): Promise<{ nodes: number; edges: number }> {
  const events = await recentEvents({ limit })
  const nodes = new Map<string, Omit<GNode, 'at'>>(); const edges: { from: string; to: string; rel: EdgeRel; w: number }[] = []
  for (const e of events) {
    if (e.userId && e.propertyId && EVENT_REL[e.type]) {
      nodes.set('u:' + e.userId, { id: 'u:' + e.userId, type: 'user', label: e.userId })
      nodes.set('p:' + e.propertyId, { id: 'p:' + e.propertyId, type: 'property', label: e.propertyId })
      const w = e.type === 'contact_made' ? 5 : e.type === 'user_saved_property' ? 3 : 1
      edges.push({ from: 'u:' + e.userId, to: 'p:' + e.propertyId, rel: EVENT_REL[e.type], w })
    }
    if (e.type === 'agent_assigned' && e.agentId) {
      nodes.set('a:' + e.agentId, { id: 'a:' + e.agentId, type: 'agent', label: e.agentId })
      if (e.leadId) { nodes.set('l:' + e.leadId, { id: 'l:' + e.leadId, type: 'lead', label: e.leadId }); edges.push({ from: 'a:' + e.agentId, to: 'l:' + e.leadId, rel: 'assigned', w: 2 }) }
      if (e.userId) { nodes.set('u:' + e.userId, { id: 'u:' + e.userId, type: 'user', label: e.userId }); edges.push({ from: 'a:' + e.agentId, to: 'u:' + e.userId, rel: 'represents', w: 2 }) }
    }
  }
  await upsertNodes(Array.from(nodes.values()))
  for (const e of edges) await addEdge(e.from, e.to, e.rel, e.w)
  return { nodes: nodes.size, edges: edges.length }
}
