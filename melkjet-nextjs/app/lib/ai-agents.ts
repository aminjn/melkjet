// Client-safe: agent definitions + model categorisation (no node imports).

export type AgentNeed = 'text' | 'both'  // 'both' = text model + image-generation model

export interface AgentDef { id: string; name: string; task: string; needs: AgentNeed }

export const AGENTS: AgentDef[] = [
  { id: 'scraper', name: 'ScraperAgent', task: 'واکشی و پردازش آگهی', needs: 'text' },
  { id: 'moderation', name: 'ModerationAgent', task: 'تأیید و امتیازدهی آگهی', needs: 'text' },
  { id: 'content', name: 'ContentAgent', task: 'تولید مقاله و سئو (متن + تصویر)', needs: 'both' },
  { id: 'pricing', name: 'PricingAgent', task: 'تحلیل و برآورد قیمت', needs: 'text' },
  { id: 'chat', name: 'ChatAgent', task: 'دستیار چت کاربر', needs: 'text' },
  { id: 'search', name: 'SearchAgent', task: 'جستجوی معنایی', needs: 'text' },
  { id: 'image', name: 'ImageAgent', task: 'تحلیل تصاویر ملک', needs: 'text' },
  { id: 'fraud', name: 'FraudAgent', task: 'تشخیص تقلب', needs: 'text' },
  { id: 'translation', name: 'TranslationAgent', task: 'ترجمه محتوا', needs: 'text' },
  { id: 'summary', name: 'SummaryAgent', task: 'خلاصه‌سازی گزارش', needs: 'text' },
  { id: 'lead', name: 'LeadAgent', task: 'مدیریت لیدهای فروش', needs: 'text' },
  { id: 'alert', name: 'AlertAgent', task: 'اعلان‌های هوشمند', needs: 'text' },
  { id: 'analytics', name: 'AnalyticsAgent', task: 'تحلیل رفتار کاربر', needs: 'text' },
  { id: 'negotiation', name: 'NegotiationAgent', task: 'پشتیبانی مذاکره', needs: 'both' },
]

export type ModelCategory = 'text' | 'image' | 'embedding' | 'audio'

export function categorizeModel(id: string): ModelCategory {
  const s = id.toLowerCase()
  if (/embedding|embed/.test(s)) return 'embedding'
  if (/tts|whisper|audio|speech|voice/.test(s)) return 'audio'
  if (/image|dall-?e|dalle|flux|sdxl|stable-?diffusion|imagen|midjourney|kandinsky|ideogram/.test(s)) return 'image'
  return 'text'
}

// Persian group labels for the dropdown
export const CATEGORY_LABEL: Record<ModelCategory, string> = {
  text: 'مدل‌های متن و چت',
  image: 'مدل‌های تولید تصویر',
  embedding: 'مدل‌های Embedding',
  audio: 'مدل‌های صوتی',
}

// Curated fallback list (used if the live /models call fails)
export const FALLBACK_MODELS: string[] = [
  'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3', 'o4-mini', 'gpt-3.5-turbo',
  'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash',
  'claude-3-7-sonnet', 'claude-3-5-sonnet', 'claude-3-5-haiku',
  'deepseek-chat', 'deepseek-reasoner', 'grok-3', 'llama-3.3-70b',
  'gpt-image-1', 'dall-e-3', 'flux-1.1-pro', 'flux-schnell', 'imagen-3', 'stable-diffusion-3.5-large',
  'text-embedding-3-small', 'text-embedding-3-large',
]

export const DEFAULT_GAP_BASE = 'https://api.gapgpt.app/v1'
