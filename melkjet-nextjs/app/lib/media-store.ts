import { readFileSync, writeFileSync, existsSync, mkdirSync } from './fs-atomic'
import { join } from 'path'
import { randomBytes } from 'crypto'

// turbopackIgnore: .media holds ~52k cached images. Left analysable, Turbopack
// folds this join() into a literal directory and every later join(DIR, x) becomes a
// glob over it - the build reported one pattern matching 210,504 files, and compile
// time went from 2.2min to 4.9min as the cache grew. Nothing here is a module; it is
// runtime data, so there is nothing for the bundler to trace.
const DIR = join(/*turbopackIgnore: true*/ process.cwd(), '.media')
const INDEX = join(/*turbopackIgnore: true*/ process.cwd(), '.media-index.json')

interface MediaMeta { id: string; ext: string; mime: string; name: string; size: number; at: number }

function ensure() { if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true }) }
function loadIndex(): MediaMeta[] { if (existsSync(INDEX)) { try { return JSON.parse(readFileSync(INDEX, 'utf-8')) } catch {} } return [] }
function saveIndex(rows: MediaMeta[]) { writeFileSync(INDEX, JSON.stringify(rows), 'utf-8') }

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'application/pdf': 'pdf',
}

export function saveMedia(buf: Buffer, mime: string, name: string): MediaMeta {
  ensure()
  const ext = EXT[mime] || (name.split('.').pop() || 'bin').toLowerCase().slice(0, 5)
  const id = randomBytes(8).toString('hex')
  writeFileSync(join(DIR, `${id}.${ext}`), buf)
  const meta: MediaMeta = { id, ext, mime, name: name.slice(0, 120), size: buf.length, at: Date.now() }
  const rows = loadIndex(); rows.unshift(meta); saveIndex(rows.slice(0, 2000))
  return meta
}

export function getMedia(id: string): { path: string; mime: string } | null {
  const m = loadIndex().find(x => x.id === id)
  if (!m) return null
  const p = join(DIR, `${m.id}.${m.ext}`)
  if (!existsSync(p)) return null
  return { path: p, mime: m.mime }
}

export function isAllowed(mime: string): boolean { return /^image\/|^video\/|^application\/pdf$/.test(mime) }
