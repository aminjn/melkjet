import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// Tiny, dependency-free JSON-file store for the professionals dashboard.
// Mirrors the persistence style of crm-store.ts. Holds two collections:
// tasks and clients. دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.pros-data.json')
const KV_KEY = 'pros'

export type Priority = 'high' | 'medium' | 'low'

export interface Task {
  id: string
  title: string
  done: boolean
  priority?: Priority
  due?: string
  createdAt: number
}

export interface Client {
  id: string
  name: string
  phone?: string
  need?: string
  status?: string
  createdAt: number
}

interface DB { tasks: Task[]; clients: Client[] }

function id() { return randomBytes(6).toString('hex') }

function fileLoad(): DB {
  if (existsSync(DATA_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
      return {
        tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
        clients: Array.isArray(raw.clients) ? raw.clients : [],
      }
    } catch {}
  }
  return { tasks: [], clients: [] }
}

function fileSave(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, { tasks: [], clients: [] }) : fileLoad() }
async function mutate<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, { tasks: [], clients: [] }, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

// ── Tasks ──────────────────────────────────────────────
export async function listTasks(): Promise<Task[]> {
  return (await load()).tasks.sort((a, b) => b.createdAt - a.createdAt)
}

export async function addTask(input: { title: string; priority?: Priority; due?: string }): Promise<Task> {
  return mutate((db) => {
    const task: Task = {
      id: id(),
      title: String(input.title || '').trim(),
      done: false,
      priority: input.priority,
      due: input.due,
      createdAt: Date.now(),
    }
    db.tasks.unshift(task)
    return task
  })
}

export async function toggleTask(taskId: string): Promise<void> {
  await mutate((db) => {
    const t = db.tasks.find(x => x.id === taskId)
    if (t) { t.done = !t.done }
  })
}

export async function deleteTask(taskId: string): Promise<void> {
  await mutate((db) => { db.tasks = db.tasks.filter(x => x.id !== taskId) })
}

// ── Clients ────────────────────────────────────────────
export async function listClients(): Promise<Client[]> {
  return (await load()).clients.sort((a, b) => b.createdAt - a.createdAt)
}

export async function addClient(input: { name: string; phone?: string; need?: string; status?: string }): Promise<Client> {
  return mutate((db) => {
    const client: Client = {
      id: id(),
      name: String(input.name || '').trim(),
      phone: input.phone,
      need: input.need,
      status: input.status,
      createdAt: Date.now(),
    }
    db.clients.unshift(client)
    return client
  })
}

export async function deleteClient(clientId: string): Promise<void> {
  await mutate((db) => { db.clients = db.clients.filter(x => x.id !== clientId) })
}
