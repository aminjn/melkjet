import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { pgEnabled, kvGet, kvMutate } from './db'

// Tiny per-user preferences store (favorites + saved searches).
// دومَحاله: اگر DATABASE_URL ست باشد → Postgres (نوشتنِ اتمیک)، وگرنه فایل.
const DATA_FILE = join(process.cwd(), '.user-data.json')
const KV_KEY = 'user'

export interface SavedSearch {
  id: string
  label: string
  query: string
  createdAt: number
}

export interface UserPrefs {
  favorites: string[]            // listing ids
  savedSearches: SavedSearch[]
}

interface DB { [userId: string]: UserPrefs }

function id() { return randomBytes(6).toString('hex') }

function fileLoad(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return {}
}

function fileSave(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

async function load(): Promise<DB> { return pgEnabled() ? await kvGet<DB>(KV_KEY, {}) : fileLoad() }
async function withDb<R>(fn: (db: DB) => R): Promise<R> {
  if (pgEnabled()) return kvMutate<DB, R>(KV_KEY, {}, fn)
  const db = fileLoad(); const r = fn(db); fileSave(db); return r
}

function ensure(db: DB, userId: string): UserPrefs {
  if (!db[userId]) db[userId] = { favorites: [], savedSearches: [] }
  const p = db[userId]
  if (!Array.isArray(p.favorites)) p.favorites = []
  if (!Array.isArray(p.savedSearches)) p.savedSearches = []
  return p
}

export async function getPrefs(userId: string): Promise<UserPrefs> {
  const db = await load()
  const p = db[userId]
  return {
    favorites: Array.isArray(p?.favorites) ? p.favorites : [],
    savedSearches: Array.isArray(p?.savedSearches) ? p.savedSearches : [],
  }
}

export async function addFavorite(userId: string, listingId: string): Promise<UserPrefs> {
  const lid = String(listingId || '').trim()
  await withDb((db) => {
    const p = ensure(db, userId)
    if (lid && !p.favorites.includes(lid)) p.favorites.unshift(lid)
  })
  return getPrefs(userId)
}

export async function removeFavorite(userId: string, listingId: string): Promise<UserPrefs> {
  await withDb((db) => {
    const p = ensure(db, userId)
    p.favorites = p.favorites.filter(x => x !== listingId)
  })
  return getPrefs(userId)
}

export async function addSavedSearch(userId: string, input: { label: string; query: string }): Promise<UserPrefs> {
  await withDb((db) => {
    const p = ensure(db, userId)
    const search: SavedSearch = {
      id: id(),
      label: String(input.label || '').trim() || String(input.query || '').trim() || 'جستجوی بدون عنوان',
      query: String(input.query || '').trim(),
      createdAt: Date.now(),
    }
    p.savedSearches.unshift(search)
  })
  return getPrefs(userId)
}

export async function removeSavedSearch(userId: string, searchId: string): Promise<UserPrefs> {
  await withDb((db) => {
    const p = ensure(db, userId)
    p.savedSearches = p.savedSearches.filter(x => x.id !== searchId)
  })
  return getPrefs(userId)
}
