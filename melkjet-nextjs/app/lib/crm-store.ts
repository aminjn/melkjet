import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// استورِ تسک‌های داشبوردِ CRM. دومَحاله: Postgres (اگر DATABASE_URL) وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.crm-data.json')
const KV_KEY = 'crm'

export type Priority = 'high' | 'medium' | 'low'

export interface Task {
  id: string
  title: string
  done: boolean
  priority?: Priority
  due?: string
  dueTs?: number
  owner?: string
  createdAt: number
}

interface DB { tasks: Task[] }
function id() { return randomBytes(6).toString('hex') }

function fileLoad(): DB {
  if (existsSync(DATA_FILE)) { try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {} }
  return { tasks: [] }
}
function fileSave(db: DB) { writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8') }

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { tasks: [] }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { tasks: [] }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

// فاز ۱۲۰ — نظارتِ سوپرادمین: همهٔ وظایفِ همهٔ کاربران
export async function listAllTasks(): Promise<Task[]> {
  return (await load()).tasks.sort((a, b) => b.createdAt - a.createdAt)
}

// فاز ۱۴۲ — انتقالِ مالکیتِ وظایف در ادغامِ دو حساب
export async function reassignTasksOwner(from: string, to: string): Promise<number> {
  return mutate(db => {
    let n = 0
    for (const t of db.tasks) if (t.owner === from) { t.owner = to; n++ }
    return n
  })
}

export async function listTasks(owner: string): Promise<Task[]> {
  return (await load()).tasks.filter(t => t.owner === owner).sort((a, b) => b.createdAt - a.createdAt)
}

export async function addTask(owner: string, input: { title: string; priority?: Priority; due?: string; dueTs?: number }): Promise<Task> {
  return mutate((db) => {
    const task: Task = {
      id: id(), title: String(input.title || '').trim(), done: false, priority: input.priority,
      due: input.due, dueTs: typeof input.dueTs === 'number' ? input.dueTs : undefined, owner, createdAt: Date.now(),
    }
    db.tasks.unshift(task)
    return task
  })
}

export async function updateTask(
  owner: string,
  taskId: string,
  patch: { title?: string; priority?: Priority; due?: string; dueTs?: number; done?: boolean }
): Promise<Task | null> {
  return mutate((db) => {
    const t = db.tasks.find(x => x.id === taskId && x.owner === owner)
    if (!t) return null
    if (patch.title !== undefined) t.title = String(patch.title).trim()
    if (patch.priority !== undefined) t.priority = patch.priority
    if (patch.due !== undefined) t.due = patch.due
    if (patch.dueTs !== undefined) t.dueTs = patch.dueTs
    if (patch.done !== undefined) t.done = patch.done
    return t
  })
}

export async function toggleTask(owner: string, taskId: string): Promise<void> {
  await mutate((db) => { const t = db.tasks.find(x => x.id === taskId && x.owner === owner); if (t) t.done = !t.done })
}

export async function deleteTask(owner: string, taskId: string): Promise<void> {
  await mutate((db) => { db.tasks = db.tasks.filter(x => !(x.id === taskId && x.owner === owner)) })
}
