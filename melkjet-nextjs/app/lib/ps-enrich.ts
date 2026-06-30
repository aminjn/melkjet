import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { chatCompleteSafe, agentModel, agentProvider } from './gapgpt'
import { computeNearby } from './nearby'

// ─── هوشِ صفحهٔ عمومیِ پروژه: دسترسی‌های واقعی (نشان) + تحلیلِ سرمایه‌گذاری (AI) ──
// همه‌چیز یک‌بار به‌ازای هر پروژه محاسبه و در .ps-enrich-data.json کش می‌شود (gitignored).
// دسترسی‌ها از سرویسِ نشان (مختصاتِ واقعی، فاصله/زمانِ واقعی) می‌آید — نه حدسِ AI.
// تحلیلِ سرمایه‌گذاری از AI با ورودیِ مشخصاتِ واقعیِ پروژه ساخته می‌شود.

const FILE = join(process.cwd(), '.ps-enrich-data.json')
const ENRICH_V = 3

export interface PSAnalysis { summary: string; risk: number; riskLabel: string; points: string[] }
export interface PSEnrich {
  v?: number
  nearby?: { type?: string; name?: string; time: string; meters?: number }[]
  nearbyNote?: string
  analysis?: PSAnalysis
  description?: string
  at?: number
}

type DB = Record<string, PSEnrich>
function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function save(db: DB) { try { writeFileSync(FILE, JSON.stringify(db), 'utf-8') } catch {} }

export function getPSEnrich(hashId: string): PSEnrich | null {
  const e = load()[hashId]
  return e && e.v === ENRICH_V && e.analysis ? e : null
}

function stripFence(s: string): string {
  const m = s.match(/\{[\s\S]*\}/); if (m) return m[0]
  return s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
}

export interface PSEnrichCtx {
  address?: string; region?: string; lat?: number | null; lng?: number | null
  phase?: string; progress?: number; floors?: number; units?: number
  residentialArea?: number; groundArea?: number; builderName?: string; builderProjects?: number
}

// تحلیلِ سرمایه‌گذاریِ AI از مشخصاتِ واقعیِ پروژه.
async function aiAnalysis(ctx: PSEnrichCtx): Promise<{ analysis?: PSAnalysis; description?: string }> {
  const model = agentModel('pricing', 'text') || agentModel('summary', 'text') || agentModel('content', 'text') || 'gpt-4o-mini'
  const provider = agentProvider('pricing', 'text') || agentProvider('summary', 'text')
  const facts = [
    ctx.region && `منطقه: ${ctx.region}`,
    ctx.address && `آدرس: ${ctx.address}`,
    ctx.phase && `مرحلهٔ ساخت: ${ctx.phase}`,
    ctx.progress != null && `پیشرفتِ فیزیکی: حدود ${ctx.progress}٪`,
    ctx.floors && `تعداد طبقات: ${ctx.floors}`,
    ctx.units && `تعداد واحد: ${ctx.units}`,
    ctx.residentialArea && `زیربنا: ${ctx.residentialArea} متر مربع`,
    ctx.groundArea && `متراژ زمین: ${ctx.groundArea} متر مربع`,
    ctx.builderName && `سازنده: ${ctx.builderName}${ctx.builderProjects ? ` (${ctx.builderProjects} پروژه)` : ''}`,
  ].filter(Boolean).join('\n')
  const sys = 'تو یک تحلیل‌گرِ ارشدِ سرمایه‌گذاریِ املاک در ایران هستی. بر اساسِ مشخصاتِ واقعیِ یک پروژهٔ ساختمانی، یک تحلیلِ کوتاهِ سرمایه‌گذاری به فارسی می‌دهی. واقع‌بین باش و فقط بر پایهٔ همین داده‌ها و دانشِ عمومیِ بازارِ منطقه قضاوت کن. خروجی فقط JSON باشد.'
  const user = `مشخصاتِ پروژه:
${facts}

یک JSON بساز:
{
  "summary": "یک پاراگرافِ ۲ تا ۳ جمله‌ایِ تحلیلِ سرمایه‌گذاری دربارهٔ موقعیت، مرحلهٔ ساخت و جذابیتِ این پروژه برای خرید/سرمایه‌گذاری",
  "risk": عددِ صحیحِ ۰ تا ۱۰۰ (امتیازِ جذابیتِ سرمایه‌گذاری؛ بالاتر = کم‌ریسک‌تر و بهتر),
  "riskLabel": "ریسک پایین" یا "ریسک متوسط" یا "ریسک بالا",
  "points": ["۳ تا ۴ نکتهٔ کوتاهِ کلیدی برای سرمایه‌گذار، مثل وضعیتِ منطقه، مرحلهٔ ساخت، اندازهٔ پروژه"],
  "description": "یک جملهٔ کوتاه دربارهٔ موقعیتِ محله"
}
فقط JSON خروجی بده.`
  try {
    const raw = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.5, max_tokens: 700 }, provider)
    const p = JSON.parse(stripFence(raw))
    const risk = Math.max(0, Math.min(100, Math.round(Number(p.risk) || 0)))
    const analysis: PSAnalysis = {
      summary: String(p.summary || '').slice(0, 600),
      risk: risk || 60,
      riskLabel: String(p.riskLabel || (risk >= 70 ? 'ریسک پایین' : risk >= 45 ? 'ریسک متوسط' : 'ریسک بالا')).slice(0, 20),
      points: Array.isArray(p.points) ? p.points.filter((x: any) => typeof x === 'string').map((x: string) => x.slice(0, 90)).slice(0, 5) : [],
    }
    return { analysis, description: typeof p.description === 'string' ? p.description.slice(0, 300) : '' }
  } catch { return {} }
}

// همهٔ هوشِ پروژه (دسترسی‌ها + تحلیل) را تضمین می‌کند (از کش یا تازه).
export async function ensurePSIntel(hashId: string, ctx: PSEnrichCtx): Promise<PSEnrich> {
  const cached = getPSEnrich(hashId)
  if (cached) return cached

  // دسترسی‌های واقعی از نشان (اگر مختصات داشت)
  let nearby: PSEnrich['nearby'] = []
  let nearbyNote: string | undefined
  const lat = Number(ctx.lat), lng = Number(ctx.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.1) {
    try { const r = await computeNearby(lat, lng); nearby = r.nearby; nearbyNote = r.note } catch {}
  }

  // تحلیلِ سرمایه‌گذاریِ AI
  const { analysis, description } = await aiAnalysis(ctx)

  const out: PSEnrich = { v: ENRICH_V, at: Date.now(), nearby, nearbyNote, analysis: analysis || { summary: '', risk: 60, riskLabel: 'ریسک متوسط', points: [] }, description: description || '' }
  // فقط وقتی تحلیل واقعاً ساخته شد کش کن (تا در صورتِ نبودِ AI دفعهٔ بعد دوباره تلاش شود)
  if (analysis) { const db = load(); db[hashId] = out; save(db) }
  return out
}
