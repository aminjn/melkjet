import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Tiny, dependency-free JSON-file store for the professionals dashboard.
// Mirrors the persistence style of crm-store.ts. Holds two collections:
// tasks and clients.
const DATA_FILE = join(process.cwd(), '.pros-data.json')

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

function load(): DB {
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

function save(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

// ── Tasks ──────────────────────────────────────────────
export function listTasks(): Task[] {
  return load().tasks.sort((a, b) => b.createdAt - a.createdAt)
}

export function addTask(input: { title: string; priority?: Priority; due?: string }): Task {
  const db = load()
  const task: Task = {
    id: id(),
    title: String(input.title || '').trim(),
    done: false,
    priority: input.priority,
    due: input.due,
    createdAt: Date.now(),
  }
  db.tasks.unshift(task)
  save(db)
  return task
}

export function toggleTask(taskId: string): void {
  const db = load()
  const t = db.tasks.find(x => x.id === taskId)
  if (t) { t.done = !t.done; save(db) }
}

export function deleteTask(taskId: string): void {
  const db = load()
  db.tasks = db.tasks.filter(x => x.id !== taskId)
  save(db)
}

// ── Clients ────────────────────────────────────────────
export function listClients(): Client[] {
  return load().clients.sort((a, b) => b.createdAt - a.createdAt)
}

export function addClient(input: { name: string; phone?: string; need?: string; status?: string }): Client {
  const db = load()
  const client: Client = {
    id: id(),
    name: String(input.name || '').trim(),
    phone: input.phone,
    need: input.need,
    status: input.status,
    createdAt: Date.now(),
  }
  db.clients.unshift(client)
  save(db)
  return client
}

export function deleteClient(clientId: string): void {
  const db = load()
  db.clients = db.clients.filter(x => x.id !== clientId)
  save(db)
}
