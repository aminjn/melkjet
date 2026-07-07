// REOS v2 · AI Agent — Memory (short-term + long-term), dual-mode PG/file.
// حافظهٔ ایجنت: fact/pref/episode/goal. جستجوی حافظه با همپوشانیِ توکن (بدونِ وابستگیِ برداری).
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, pgTx } from '../../db'
import { tokenize } from '../features'

export type MemoryKind = 'fact' | 'pref' | 'episode' | 'goal'
export interface Memory { id: string; userId: string; kind: MemoryKind; content: string; meta?: Record<string, unknown>; at: number }

const MEM_FILE = join(process.cwd(), '.reos-agent-memory.json')
const TASK_FILE = join(process.cwd(), '.reos-agent-tasks.json')
function uid(p: string): string { return p + randomBytes(6).toString('hex') }
function fileLoad<T>(f: string, fb: T): T { if (existsSync(f)) { try { return JSON.parse(readFileSync(f, 'utf-8')) } catch {} } return fb }
function fileSave(f: string, d: unknown): void { try { writeFileSync(f, JSON.stringify(d)) } catch {} }

let ready = false
async function ensure(): Promise<void> {
  if (ready) return
  await pgTx(async c => {
    await c.query(`CREATE TABLE IF NOT EXISTS reos_agent_memory (
      id text PRIMARY KEY, user_id text NOT NULL, kind text NOT NULL,
      content text NOT NULL, meta jsonb NOT NULL DEFAULT '{}'::jsonb, at bigint NOT NULL )`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_agent_memory_user ON reos_agent_memory(user_id)`)
    await c.query(`CREATE TABLE IF NOT EXISTS reos_agent_tasks (
      id text PRIMARY KEY, user_id text NOT NULL, goal text NOT NULL, answer text,
      trace jsonb NOT NULL DEFAULT '[]'::jsonb, steps int NOT NULL DEFAULT 0, at bigint NOT NULL )`)
    await c.query(`CREATE INDEX IF NOT EXISTS reos_agent_tasks_user ON reos_agent_tasks(user_id)`)
  })
  ready = true
}

export async function saveMemory(m: Omit<Memory, 'id' | 'at'> & { at?: number }): Promise<Memory> {
  const mem: Memory = { id: uid('mem_'), at: m.at || Date.now(), userId: m.userId, kind: m.kind, content: m.content, meta: m.meta || {} }
  if (pgEnabled()) {
    await ensure()
    await pgTx(c => c.query(`INSERT INTO reos_agent_memory(id,user_id,kind,content,meta,at) VALUES($1,$2,$3,$4,$5,$6)`,
      [mem.id, mem.userId, mem.kind, mem.content, JSON.stringify(mem.meta), mem.at]))
  } else {
    const db = fileLoad<Memory[]>(MEM_FILE, []); db.unshift(mem); if (db.length > 5000) db.length = 5000; fileSave(MEM_FILE, db)
  }
  return mem
}

export async function getMemories(userId: string, opts: { kind?: MemoryKind; limit?: number } = {}): Promise<Memory[]> {
  const limit = Math.min(opts.limit ?? 50, 500)
  if (pgEnabled()) {
    await ensure()
    const params: unknown[] = [userId]; let where = 'user_id=$1'
    if (opts.kind) { params.push(opts.kind); where += ` AND kind=$${params.length}` }
    params.push(limit)
    const r = await pgTx(c => c.query(`SELECT * FROM reos_agent_memory WHERE ${where} ORDER BY at DESC LIMIT $${params.length}`, params))
    return r.rows.map(x => ({ id: x.id, userId: x.user_id, kind: x.kind, content: x.content, meta: x.meta || {}, at: Number(x.at) }))
  }
  let db = fileLoad<Memory[]>(MEM_FILE, []).filter(m => m.userId === userId)
  if (opts.kind) db = db.filter(m => m.kind === opts.kind)
  return db.slice(0, limit)
}

// جستجوی حافظه با ارتباطِ توکنی (relevance) — برای تزریقِ زمینه به planner.
export async function searchMemories(userId: string, query: string, k = 5): Promise<Memory[]> {
  const all = await getMemories(userId, { limit: 300 })
  const q = new Set(tokenize(query))
  if (!q.size) return all.slice(0, k)
  const scored = all.map(m => {
    const toks = tokenize(m.content)
    let hit = 0; for (const t of toks) if (q.has(t)) hit++
    return { m, score: hit / Math.max(3, toks.length) + (m.kind === 'pref' || m.kind === 'goal' ? 0.1 : 0) }
  }).filter(x => x.score > 0)
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k).map(x => x.m)
}

// ═══ Agent tasks (ثبتِ اجرای ایجنت + trace) ═══
export interface AgentTask { id: string; userId: string; goal: string; answer: string; trace: unknown[]; steps: number; at: number }
export async function saveTask(t: Omit<AgentTask, 'id' | 'at'> & { at?: number }): Promise<AgentTask> {
  const task: AgentTask = { id: uid('task_'), at: t.at || Date.now(), userId: t.userId, goal: t.goal, answer: t.answer, trace: t.trace, steps: t.steps }
  if (pgEnabled()) {
    await ensure()
    await pgTx(c => c.query(`INSERT INTO reos_agent_tasks(id,user_id,goal,answer,trace,steps,at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [task.id, task.userId, task.goal, task.answer, JSON.stringify(task.trace), task.steps, task.at]))
  } else {
    const db = fileLoad<AgentTask[]>(TASK_FILE, []); db.unshift(task); if (db.length > 2000) db.length = 2000; fileSave(TASK_FILE, db)
  }
  return task
}
export async function recentTasks(userId: string, limit = 20): Promise<AgentTask[]> {
  if (pgEnabled()) {
    await ensure()
    const r = await pgTx(c => c.query(`SELECT * FROM reos_agent_tasks WHERE user_id=$1 ORDER BY at DESC LIMIT $2`, [userId, Math.min(limit, 100)]))
    return r.rows.map(x => ({ id: x.id, userId: x.user_id, goal: x.goal, answer: x.answer || '', trace: x.trace || [], steps: x.steps, at: Number(x.at) }))
  }
  return fileLoad<AgentTask[]>(TASK_FILE, []).filter(t => t.userId === userId).slice(0, limit)
}
