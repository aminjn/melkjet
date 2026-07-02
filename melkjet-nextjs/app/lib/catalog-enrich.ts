// تکمیلِ خودکارِ توضیحات و مشخصاتِ فنیِ محصولاتِ اسکرپ‌شده با هوش مصنوعی.
// فقط محصولاتی که توضیح/مشخصاتِ کافی ندارند پردازش می‌شوند → «یک‌بار» تولید؛ در
// اسکرپِ بعدی هم فقط جاهای خالی چک و پُر می‌شوند.
import { productsNeedingEnrich, setProductEnrichment, type CatalogProduct } from './catalog-store'
import { listCategories } from './catalog-store'
import { chatCompleteSafe, agentModel, agentProvider } from './gapgpt'

function catName(id: string) { return listCategories().find(c => c.id === id)?.name || '' }

function parseJson(text: string): any {
  const t = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim()
  const s = t.indexOf('{'), e = t.lastIndexOf('}')
  if (s < 0 || e < 0) return null
  try { return JSON.parse(t.slice(s, e + 1)) } catch { return null }
}

async function enrichOne(model: string, provider: string | undefined, p: CatalogProduct): Promise<boolean> {
  const existing = (p.specs || []).map(s => `${s.key}: ${s.value}`).join('، ')
  const prompt = `تو کارشناسِ فروشِ مصالحِ ساختمانی هستی. برای محصولِ زیر یک «توضیحِ حرفه‌ایِ فارسیِ ۲ تا ۴ جمله‌ای» و «مشخصاتِ فنیِ کلیدی» بنویس (واقع‌بینانه بر اساسِ نامِ محصول؛ چیزی از خودت جعل نکن که مطمئن نیستی).
نام: ${p.name}
${p.brand ? `برند/کارخانه: ${p.brand}\n` : ''}دسته: ${catName(p.categoryId)}
${existing ? `مشخصاتِ موجود: ${existing}\n` : ''}
فقط و فقط یک JSON برگردان، بدونِ هیچ متنِ اضافه:
{"description":"...","specs":[{"key":"جنس","value":"..."},{"key":"کاربرد","value":"..."}]}`
  let out = ''
  try { out = await chatCompleteSafe(model, [{ role: 'user', content: prompt }], { temperature: 0.5, max_tokens: 500 }, provider) } catch { return false }
  const j = parseJson(out); if (!j) return false
  const specs = Array.isArray(j.specs) ? j.specs.filter((s: any) => s && s.key && s.value) : []
  return setProductEnrichment(p.id, { description: typeof j.description === 'string' ? j.description : undefined, specs })
}

// یک بَچِ کوچک را پردازش می‌کند (برای دکمهٔ ادمین که تا پایان تکرار می‌کند و برای اسکرپِ خودکار).
export async function enrichCatalogBatch(opts: { source?: string; limit?: number } = {}): Promise<{ enriched: number; remaining: number; noModel?: boolean }> {
  const model = agentModel('content', 'text') || 'gpt-4o-mini'
  const provider = agentProvider('content', 'text')
  if (!model) return { enriched: 0, remaining: 0, noModel: true }
  const limit = Math.min(6, Math.max(1, opts.limit || 4))
  const need = productsNeedingEnrich(opts.source, limit)
  let enriched = 0
  for (const p of need) { if (await enrichOne(model, provider, p)) enriched++ }
  const remaining = productsNeedingEnrich(opts.source).length
  return { enriched, remaining }
}
