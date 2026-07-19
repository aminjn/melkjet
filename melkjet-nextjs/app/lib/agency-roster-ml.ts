import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pgEnabled, kvGet, kvMutate } from './db'

// ── مدلِ یادگیرندهٔ «اسمِ مشاور» ──────────────────────────────────────────────
// هدف: تشخیصِ نامِ مشاور از متنِ آگهی، و «یادگیریِ تدریجی» تا کم‌کم مستقل از AI شود.
// منابعِ یادگیری (به ترتیبِ وزن):
//   • تأییدِ ادمین (ساختِ حساب برای یک مشاور) = قوی‌ترین سیگنال.
//   • نامی که AI از متن استخراج و تأیید کرده.
// وقتی نامی در واژه‌نامه ثبت شد، دفعهٔ بعد بدونِ هیچ فراخوانیِ AI و به‌صورتِ قطعی
// از متنِ آگهی پیدا می‌شود (سریع، رایگان، پایدار). این یعنی «ماشین خودش یاد می‌گیرد».
const FILE = join(process.cwd(), '.agency-ml-data.json')
const KV = 'agency_ml'

interface NameRec { name: string; weight: number; at: number; teacher: 'ai' | 'admin' }
interface MLData { names: Record<string, NameRec>; negatives: Record<string, number> }
const empty = (): MLData => ({ names: {}, negatives: {} })

function fileLoad(): MLData { if (existsSync(FILE)) { try { const d = JSON.parse(readFileSync(FILE, 'utf-8')); return { names: d.names || {}, negatives: d.negatives || {} } } catch {} } return empty() }
function fileSave(db: MLData) { writeFileSync(FILE, JSON.stringify(db, null, 2), 'utf-8') }
async function load(): Promise<MLData> { return pgEnabled() ? await kvGet<MLData>(KV, empty()) : fileLoad() }
async function mutate<R>(fn: (db: MLData) => R): Promise<R> { if (pgEnabled()) return kvMutate<MLData, R>(KV, empty(), fn); const db = fileLoad(); const r = fn(db); fileSave(db); return r }

const ZWNJ = /‌/g
// کلیدِ نرمالِ نام (برای مقایسه). فارسی یکدست، لاتین CAPS، بدونِ فاصله/نیم‌فاصله.
export function nameKey(name: string): string {
  const s = String(name || '').replace(ZWNJ, '').replace(/\s+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
  return /^[A-Za-z ]+$/.test(s) ? s.toUpperCase() : s
}

// یادگیریِ یک نام (افزودن/تقویتِ وزن). ادمین وزنِ بالاتری می‌دهد.
export async function learnName(name: string, teacher: 'ai' | 'admin' = 'ai'): Promise<void> {
  const n = String(name || '').trim()
  if (!n || n.length < 2) return
  const k = nameKey(n)
  await mutate(db => {
    if (db.negatives[k]) delete db.negatives[k]   // اگر قبلاً منفی بود، تأییدِ جدید آزادش می‌کند
    const cur = db.names[k]
    const add = teacher === 'admin' ? 5 : 1
    db.names[k] = { name: n, weight: (cur?.weight || 0) + add, at: Date.now(), teacher: teacher === 'admin' ? 'admin' : (cur?.teacher || 'ai') }
  })
}

// فراموشیِ یک نام (ادمین یک خوشهٔ خراب را حذف کرد → دیگر آن نام تشخیص داده نشود).
export async function forgetName(name: string): Promise<void> {
  const k = nameKey(name)
  await mutate(db => { delete db.names[k]; db.negatives[k] = (db.negatives[k] || 0) + 1 })
}

// فهرستِ نام‌های آموخته‌شده (برای تطبیقِ لغوی هنگامِ اسکرپ). مرتب بر اساسِ وزن.
export async function knownNames(minWeight = 1): Promise<{ name: string; key: string; weight: number }[]> {
  const db = await load()
  return Object.entries(db.names)
    .filter(([, r]) => r.weight >= minWeight)
    .sort((a, b) => b[1].weight - a[1].weight)
    .map(([key, r]) => ({ name: r.name, key, weight: r.weight }))
}

export async function isNegativeName(name: string): Promise<boolean> {
  return !!(await load()).negatives[nameKey(name)]
}

export async function mlStats() {
  const db = await load()
  const names = Object.values(db.names)
  return {
    learned: names.length,
    byAdmin: names.filter(n => n.teacher === 'admin').length,
    byAi: names.filter(n => n.teacher === 'ai').length,
    negatives: Object.keys(db.negatives).length,
    top: names.sort((a, b) => b.weight - a.weight).slice(0, 20).map(n => ({ name: n.name, weight: n.weight, teacher: n.teacher })),
  }
}

export async function resetMl(): Promise<void> { await mutate(db => { db.names = {}; db.negatives = {} }) }
