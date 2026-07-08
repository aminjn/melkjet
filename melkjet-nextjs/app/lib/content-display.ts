// Client-side helpers to render scraped items as cards with stable visuals.

export interface ContentItem {
  id: string
  sourceName: string
  type: string
  category?: string
  title: string
  price?: string
  location?: string
  image?: string
  url?: string
  excerpt?: string
  phone?: string
  hasPhone?: boolean
  rating?: string
  tags?: string[]
  owner?: string
  meta?: Record<string, string>
  scrapedAt: number
  status: string
  promoted?: boolean
  promoKind?: string
}

const GRADIENTS = [
  ['#1a3a5c', '#2d6a8f'], ['#3d1f5c', '#7b4fa0'], ['#1a4a2e', '#2d8a52'],
  ['#5c1a1a', '#a03030'], ['#1a3a4a', '#2d6a8f'], ['#3a2a10', '#8f6a20'],
  ['#2a1a4a', '#5a3a8f'], ['#14323a', '#2d7a8f'], ['#3a1430', '#8f2d6a'],
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function gradientFor(seed: string, kind: 'cover' | 'avatar' = 'cover'): string {
  const [a, b] = GRADIENTS[hash(seed) % GRADIENTS.length]
  return kind === 'avatar'
    ? `linear-gradient(135deg, ${b} 0%, ${a} 100%)`
    : `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '؟'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return parts[0][0] + '.' + parts[1][0]
}

export async function fetchContent(type: string, category?: string, limit = 60, slim = false): Promise<ContentItem[]> {
  try {
    const q = new URLSearchParams({ type, limit: String(limit) })
    if (category) q.set('category', category)
    if (slim) q.set('slim', '1')   // فیلدهای سبک ولی کلِ استخرِ آگهی‌ها — برای جستجو
    const r = await fetch(`/api/content?${q.toString()}`, { cache: 'no-store' })
    if (!r.ok) return []
    return (await r.json()).items || []
  } catch {
    return []
  }
}
