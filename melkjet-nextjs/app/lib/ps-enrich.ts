import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { chatCompleteSafe, agentModel, agentProvider } from './gapgpt'

// ─── غنی‌سازیِ AI برای صفحهٔ عمومیِ پروژه (دسترسی‌ها، امکاناتِ محله، توضیح) ──────
// فقط یک‌بار به‌ازای هر پروژه محاسبه و در .ps-enrich-data.json کش می‌شود (gitignored).
// ورودیِ AI فقط آدرس/منطقهٔ واقعیِ پروژه است؛ چیزی فیک ساخته نمی‌شود — اگر AI در
// دسترس نبود، بخش خالی می‌ماند (به‌جای دادهٔ ساختگی).

const FILE = join(process.cwd(), '.ps-enrich-data.json')
const ENRICH_V = 1

export interface PSEnrich {
  v?: number
  access?: string[]                 // دسترسی‌ها (مترو، بزرگراه، خیابان اصلی، BRT…)
  amenities?: { icon?: string; label: string }[]  // امکاناتِ اطرافِ محله
  description?: string              // توضیحِ کوتاهِ موقعیتِ محله
  at?: number
}

type DB = Record<string, PSEnrich>
function load(): DB { if (existsSync(FILE)) { try { return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {} } return {} }
function save(db: DB) { try { writeFileSync(FILE, JSON.stringify(db), 'utf-8') } catch {} }

export function getPSEnrich(hashId: string): PSEnrich | null {
  const e = load()[hashId]
  return e && e.v === ENRICH_V ? e : null
}

function stripFence(s: string): string {
  return s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
}

// غنی‌سازیِ یک پروژه را تضمین می‌کند (از کش یا با تولیدِ تازه).
export async function ensurePSEnrich(hashId: string, ctx: { address?: string; region?: string }): Promise<PSEnrich> {
  const cached = getPSEnrich(hashId)
  if (cached) return cached

  const region = ctx.region || ''
  const address = ctx.address || ''
  if (!region && !address) { const empty = { v: ENRICH_V, at: Date.now(), access: [], amenities: [], description: '' }; const db = load(); db[hashId] = empty; save(db); return empty }

  const model = agentModel('search', 'text') || agentModel('summary', 'text') || 'gpt-4o-mini'
  const provider = agentProvider('search', 'text') || agentProvider('summary', 'text')
  const sys = 'تو یک کارشناسِ املاک و آشنا به جغرافیای شهری ایران هستی. بر اساسِ آدرس و منطقهٔ یک پروژهٔ ساختمانی، اطلاعاتِ موقعیتِ مکانی را به فارسی و فقط به‌صورتِ JSON می‌دهی. هیچ متنِ اضافه‌ای ننویس.'
  const user = `برای این پروژه در «${region}${address ? '، ' + address : ''}» یک JSON بساز با این کلیدها:
{
  "access": ["نزدیک‌ترین دسترسی‌های حمل‌ونقل و راه‌ها مثل ایستگاه مترو، خط BRT، بزرگراه‌ها و خیابان‌های اصلیِ این منطقه (۳ تا ۶ مورد، کوتاه)"],
  "amenities": [{"icon":"یک ایموجی","label":"یک امکانِ شاخصِ اطرافِ این محله مثل مرکز خرید، بیمارستان، پارک، مدرسه (۳ تا ۶ مورد)"}],
  "description": "یک پاراگرافِ کوتاهِ ۱ تا ۲ جمله‌ای دربارهٔ موقعیت و ویژگیِ این محله"
}
فقط دربارهٔ مواردی بنویس که واقعاً برای این منطقه شناخته‌شده‌اند. اگر دربارهٔ آدرسِ دقیق مطمئن نیستی، در سطحِ منطقه بنویس. فقط JSON خروجی بده.`

  try {
    const raw = await chatCompleteSafe(model, [{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.4, max_tokens: 600 }, provider)
    const parsed = JSON.parse(stripFence(raw))
    const out: PSEnrich = {
      v: ENRICH_V, at: Date.now(),
      access: Array.isArray(parsed.access) ? parsed.access.filter((x: any) => typeof x === 'string').slice(0, 8) : [],
      amenities: Array.isArray(parsed.amenities) ? parsed.amenities.filter((x: any) => x && x.label).map((x: any) => ({ icon: String(x.icon || '📍').slice(0, 3), label: String(x.label).slice(0, 60) })).slice(0, 8) : [],
      description: typeof parsed.description === 'string' ? parsed.description.slice(0, 400) : '',
    }
    const db = load(); db[hashId] = out; save(db)
    return out
  } catch {
    // در صورتِ خطا، خالی (بدونِ کش‌کردنِ خطا تا دفعهٔ بعد دوباره تلاش شود)
    return { v: ENRICH_V, at: Date.now(), access: [], amenities: [], description: '' }
  }
}
