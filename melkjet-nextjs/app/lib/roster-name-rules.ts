// فهرستِ سیاه/سفیدِ نامِ مشاور — مدیریتِ زنده از سوپرادمین (بدونِ دیپلوی).
//   • سیاه: واژه‌ای که هرگز نامِ مشاور نیست (دوست، پیچ، متریال…) → رد.
//   • سفید: واژه‌ای که نامِ واقعی است ولی اشتباهاً نوفه تشخیص داده می‌شود → همیشه مجاز.
// سراسری (روی همهٔ آژانس‌ها)، بدونِ شرط. موتورِ نام (agency-name-lexicon.isNoiseWord) در لحظه از
// کشِ سینکِ این ماژول می‌خواند؛ پس هر ویرایش در سینکِ بعدی اثر می‌کند، بدونِ دیپلوی.
import { kvGet, kvSet, pgEnabled } from './db'
import { readJsonCached, writeJsonCached } from './json-file'
import { keyOf } from './agency-name-lexicon'
import { join } from 'path'

const KV = 'roster_name_rules'
const FILE = join(process.cwd(), '.roster-name-rules.json')
export interface NameRules { blacklist: string[]; whitelist: string[] }
const EMPTY: NameRules = { blacklist: [], whitelist: [] }
// یکتا، trim، بدونِ خالی، سقفِ منطقی.
const clean = (a?: string[]): string[] => [...new Set((a || []).map(s => String(s || '').trim()).filter(Boolean))].slice(0, 5000)

export async function getNameRules(): Promise<NameRules> {
  try {
    const r = pgEnabled() ? await kvGet<NameRules>(KV, EMPTY) : readJsonCached<NameRules>(FILE, EMPTY)
    return { blacklist: clean(r?.blacklist), whitelist: clean(r?.whitelist) }
  } catch { return { blacklist: [], whitelist: [] } }
}

export async function setNameRules(r: NameRules): Promise<NameRules> {
  const v: NameRules = { blacklist: clean(r?.blacklist), whitelist: clean(r?.whitelist) }
  if (pgEnabled()) await kvSet(KV, v); else writeJsonCached(FILE, v)
  applyCache(v)   // اثرِ فوری روی همین پروسه؛ بقیهٔ اینستنس‌ها در loadNameRistِ سینکِ بعدی می‌بینند
  return v
}

// ── کشِ سینکِ مسیرِ داغ (isNoiseWord سینک است و per-token صدا می‌شود) ──
// keyOf-نرمال تا با مقایسهٔ lexicon هم‌خوان باشد.
let black = new Set<string>()
let white = new Set<string>()
let blackRaw: string[] = []   // صورتِ اصلی (برای تطبیقِ عبارتِ چندکلمه‌ای در متنِ آگهی)
let whiteRaw: string[] = []
function applyCache(r: NameRules) {
  black = new Set(r.blacklist.map(keyOf)); white = new Set(r.whitelist.map(keyOf))
  blackRaw = r.blacklist.slice(); whiteRaw = r.whitelist.slice()
}
export function nameRuleSets(): { black: Set<string>; white: Set<string> } { return { black, white } }
// صورتِ اصلیِ واژه‌ها — extractSignature برای «آیا نامِ وایت‌لیست در متن آمده؟» لازمش دارد.
export function nameRuleLists(): { blacklist: string[]; whitelist: string[] } { return { blacklist: blackRaw, whitelist: whiteRaw } }

// در ابتدای buildAgencyRoster صدا زده می‌شود تا قواعدِ تازه در این سینک اعمال شوند.
export async function loadNameRules(): Promise<void> { try { applyCache(await getNameRules()) } catch {} }
