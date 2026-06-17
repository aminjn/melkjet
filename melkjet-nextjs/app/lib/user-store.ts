import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Tiny, dependency-free per-user preferences store (favorites + saved searches).
// Mirrors the persistence style of crm-store.ts / scraper-store.ts.
const DATA_FILE = join(process.cwd(), '.user-data.json')

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

function load(): DB {
  if (existsSync(DATA_FILE)) {
    try { return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) } catch {}
  }
  return {}
}

function save(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

function ensure(db: DB, userId: string): UserPrefs {
  if (!db[userId]) db[userId] = { favorites: [], savedSearches: [] }
  const p = db[userId]
  if (!Array.isArray(p.favorites)) p.favorites = []
  if (!Array.isArray(p.savedSearches)) p.savedSearches = []
  return p
}

export function getPrefs(userId: string): UserPrefs {
  const db = load()
  const p = db[userId]
  return {
    favorites: Array.isArray(p?.favorites) ? p.favorites : [],
    savedSearches: Array.isArray(p?.savedSearches) ? p.savedSearches : [],
  }
}

export function addFavorite(userId: string, listingId: string): UserPrefs {
  const lid = String(listingId || '').trim()
  const db = load()
  const p = ensure(db, userId)
  if (lid && !p.favorites.includes(lid)) p.favorites.unshift(lid)
  save(db)
  return getPrefs(userId)
}

export function removeFavorite(userId: string, listingId: string): UserPrefs {
  const db = load()
  const p = ensure(db, userId)
  p.favorites = p.favorites.filter(x => x !== listingId)
  save(db)
  return getPrefs(userId)
}

export function addSavedSearch(userId: string, input: { label: string; query: string }): UserPrefs {
  const db = load()
  const p = ensure(db, userId)
  const search: SavedSearch = {
    id: id(),
    label: String(input.label || '').trim() || String(input.query || '').trim() || 'جستجوی بدون عنوان',
    query: String(input.query || '').trim(),
    createdAt: Date.now(),
  }
  p.savedSearches.unshift(search)
  save(db)
  return getPrefs(userId)
}

export function removeSavedSearch(userId: string, searchId: string): UserPrefs {
  const db = load()
  const p = ensure(db, userId)
  p.savedSearches = p.savedSearches.filter(x => x.id !== searchId)
  save(db)
  return getPrefs(userId)
}
