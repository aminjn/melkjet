import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Tiny, dependency-free JSON-file task store for the CRM dashboard.
// Mirrors the persistence style of scraper-store.ts.
const DATA_FILE = join(process.cwd(), '.crm-data.json')

export type Priority = 'high' | 'medium' | 'low'

export interface Task {
  id: string
  title: string
  done: boolean
  priority?: Priority
  due?: string
  createdAt: number
}

interface DB { tasks: Task[] }

function id() { return randomBytes(6).toString('hex') }

function load(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return { tasks: [] }
}

function save(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

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
