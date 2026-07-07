// REOS v5 · Model Catalog / Marketplace — فهرستِ مدل‌های REOS با وضعیتِ واقعی.
// نشان می‌دهد کدام مدل «آموزش‌دیده» است و کدام «فرمول» (شفافیتِ صادقانه برای کاربر/ادمین).
import { getFeatures } from './store'

export type ModelType = 'trained' | 'online' | 'formula' | 'embedding'
export interface CatalogModel { key: string; name: string; purpose: string; type: ModelType; status: string; metric?: string }

const fa = (n: number) => (n || 0).toLocaleString('fa-IR')
function trainedStatus(f: Record<string, number>): { status: string; metric?: string } {
  if (!f || !f.trainedAt) return { status: 'آموزش‌ندیده — با دادهٔ بیشتر آموزش دهید' }
  if (f.usedDefault) return { status: `پیش‌فرضِ امن (نمونه: ${fa(f.n || 0)})` }
  return { status: `آموزش‌دیده روی ${fa(f.n || 0)} نمونه`, metric: `AUC ${(f.auc || 0).toLocaleString('fa-IR')}` }
}

export async function modelCatalog(): Promise<CatalogModel[]> {
  const [eng, lead] = await Promise.all([
    getFeatures('model', 'engage_v1').catch(() => ({} as Record<string, number>)),
    getFeatures('model', 'lead_v1').catch(() => ({} as Record<string, number>)),
  ])
  const e = trainedStatus(eng), l = trainedStatus(lead)
  return [
    { key: 'engage', name: 'مدلِ تعامل / رتبه‌بندیِ فید', purpose: 'پیش‌بینیِ احتمالِ تعاملِ کاربر با ملک', type: 'trained', status: e.status, metric: e.metric },
    { key: 'lead', name: 'مدلِ تبدیلِ لید', purpose: 'احتمالِ بستنِ معامله برای هر لید', type: 'trained', status: l.status, metric: l.metric },
    { key: 'rl', name: 'سیاستِ یادگیریِ آنلاین (RL)', purpose: 'به‌روزرسانیِ رتبه‌بندی از پاداشِ رفتار', type: 'online', status: 'فعال — لحظه‌ای یاد می‌گیرد' },
    { key: 'ltr', name: 'Learning-to-Rank (pairwise)', purpose: 'رتبه‌بندیِ ترتیبی', type: 'trained', status: 'آماده' },
    { key: 'avm', name: 'ارزش‌گذاریِ خودکار (AVM)', purpose: 'قیمتِ منصفانه از فایل‌های مشابه', type: 'formula', status: 'فعال (روشِ آماری)' },
    { key: 'demand', name: 'پیش‌بینیِ تقاضا', purpose: 'شاخصِ تقاضای ملک', type: 'formula', status: 'فعال (روشِ آماری)' },
    { key: 'twin', name: 'Property Digital Twin', purpose: 'پیش‌بینیِ فروش/نقدشوندگی/ریسک', type: 'formula', status: 'فعال (ترکیبی)' },
    { key: 'embed', name: 'Embedding (pgvector/HNSW)', purpose: 'شباهتِ برداریِ املاک', type: 'embedding', status: 'فعال' },
  ]
}
