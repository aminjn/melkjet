// تکمیلِ خودکارِ توضیحات و مشخصاتِ فنیِ محصولاتِ اسکرپ‌شده با هوش مصنوعی.
// فقط محصولاتی که توضیح/مشخصاتِ کافی ندارند پردازش می‌شوند → «یک‌بار» تولید؛ در
// اسکرپِ بعدی هم فقط جاهای خالی چک و پُر می‌شوند.
import { productsNeedingEnrich, setProductEnrichment, type CatalogProduct } from './catalog-store'
import { listCategories } from './catalog-store'
import { aiFor, agentModel, agentProvider } from './gapgpt'
const { chatCompleteSafe } = aiFor('غنی‌سازیِ کاتالوگ')   // فاز ۵۷: منبعِ صریح در دفترِ مصرفِ AI

function catName(id: string) { return listCategories().find(c => c.id === id)?.name || '' }

function parseJson(text: string): any {
  const t = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim()
  const s = t.indexOf('{'), e = t.lastIndexOf('}')
  if (s < 0 || e < 0) return null
  try { return JSON.parse(t.slice(s, e + 1)) } catch { return null }
}

async function enrichOne(model: string, provider: string | undefined, p: CatalogProduct): Promise<boolean> {
  const existing = (p.specs || []).map(s => `${s.key}: ${s.value}`).join('، ')
  const prompt = `تو کارشناسِ فروشِ مصالحِ ساختمانی هستی. برای محصولِ زیر بنویس:
۱) یک «توضیحِ حرفه‌ایِ فارسیِ ۳ تا ۵ جمله‌ای» شاملِ ویژگی‌ها، کاربرد و نکاتِ خرید.
۲) «مشخصاتِ فنیِ کامل» — حداقل ۵ و حداکثر ۸ مورد. از میانِ این کلیدها آن‌هایی که از نامِ محصول منطقی استنتاج می‌شوند را بیاور: جنس، استاندارد، حالت/شکل، سایز/ابعاد، قطر، ضخامت، طول، وزنِ تقریبی، رده/گرید، آنالیز، کاربرد، محلِ تولید/کارخانه، بسته‌بندی.
واقع‌بینانه باش؛ چیزی که مطمئن نیستی را ننویس، ولی تا جای ممکن کامل و مفید بنویس.
نام: ${p.name}
${p.brand ? `برند/کارخانه: ${p.brand}\n` : ''}دسته: ${catName(p.categoryId)}
${existing ? `مشخصاتِ موجود (تکرار نکن): ${existing}\n` : ''}
فقط و فقط یک JSON برگردان، بدونِ هیچ متنِ اضافه، بدونِ کلیدِ «قیمت» یا «تاریخ»:
{"description":"...","specs":[{"key":"جنس","value":"..."},{"key":"استاندارد","value":"..."},{"key":"کاربرد","value":"..."}]}`
  let out = ''
  try { out = await chatCompleteSafe(model, [{ role: 'user', content: prompt }], { temperature: 0.5, max_tokens: 700 }, provider) } catch { return false }
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
