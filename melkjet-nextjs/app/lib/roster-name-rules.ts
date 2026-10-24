// فهرستِ سیاه/سفیدِ نامِ مشاور — مدیریتِ زنده از سوپرادمین (بدونِ دیپلوی).
//   • سیاه: واژه/عبارتی که هرگز نامِ مشاور نیست (دوست، پیچ، متریال استفاده…) → رد.
//   • سفید: نامِ واقعی که سیستم نمی‌گیرد → هر جا در متنِ آگهی بیاید، قطعی نامِ مشاور می‌شود.
// سراسری، بدونِ شرط. در سینکِ بعدیِ هر آژانس اثر می‌کند (agency-roster → loadNameRules).
//
// ⚠️ ایزوله از مدلِ ML: این ماژول (که `db` را می‌کشد) «هرگز» نباید توسطِ واژه‌نامهٔ برگ
// (agency-name-lexicon) یا مدل (roster-ner) import شود. جهتِ وابستگی یک‌طرفه است:
//   roster-name-rules → agency-name-lexicon (فقط keyOf + setNameRuleCache)
//   roster-name-rules → db / json-file
// واژه‌نامه هیچ‌چیز import نمی‌کند؛ قواعد با setNameRuleCache «هل» داده می‌شوند. پس بارگذاریِ
// مدل (roster-ner → agency-name-lexicon) هرگز به db/این‌ماژول نمی‌رسد — ریشهٔ باگِ قبلی بسته شد.
import { kvGet, kvSet, pgEnabled } from './db'
import { readJsonCached, writeJsonCached } from './json-file'
import { keyOf, setNameRuleCache } from './agency-name-lexicon'
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
  applyCache(v)   // اثرِ فوری روی همین پروسه؛ بقیهٔ اینستنس‌ها در loadNameRulesِ سینکِ بعدی می‌بینند
  return v
}

// قواعد را به کشِ واژه‌نامه «هل» می‌دهد (keyOf-نرمال). whitelistِ خام هم برای force-matchِ
// extractSignature لازم است (تطبیقِ دنبالهٔ واژه در متنِ آگهی).
function applyCache(r: NameRules): void {
  setNameRuleCache(new Set(r.blacklist.map(keyOf)), new Set(r.whitelist.map(keyOf)), r.whitelist.slice())
}

// در ابتدای buildAgencyRoster صدا زده می‌شود تا قواعدِ تازه در این سینک اعمال شوند.
export async function loadNameRules(): Promise<void> { try { applyCache(await getNameRules()) } catch {} }
