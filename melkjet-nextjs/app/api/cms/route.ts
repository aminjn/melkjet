import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { addArticle, updateArticle, listArticles, deleteItem, getItemById, ArticleInput, Item } from '@/app/lib/scraper-store'

// CMS مقالات (شبیه وردپرس) — نوشتن/ویرایش برای هر کاربر واردشده در همهٔ پنل‌ها.
function toArticle(it: Item) {
  const m = it.meta || {}
  return {
    id: it.id, title: it.title, body: it.excerpt || '', image: it.image || '',
    category: it.category || '', tags: it.tags || [],
    slug: m.slug || '', seoTitle: m.seoTitle || it.title, metaDescription: m.metaDescription || '',
    focusKeyword: m.focusKeyword || '', status: m.cmsStatus || 'published', author: m.author || it.sourceName,
    excerpt: m.summary || '', updatedAt: it.scrapedAt, edited: !!it.edited,
  }
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (id) { const it = await getItemById(id); return NextResponse.json({ article: it && it.type === 'article' ? toArticle(it) : null }) }
  return NextResponse.json({ articles: (await listArticles()).map(toArticle) })
}

// حذف اسکریپت و هندلرهای خطرناک از HTML ذخیره‌شده
function sanitize(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?(?:script|object|embed)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای انتشار باید وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({})) as ArticleInput
  if (!b.title || !b.body) return NextResponse.json({ error: 'عنوان و متن مقاله الزامی است' }, { status: 400 })
  const it = await addArticle({ ...b, body: sanitize(b.body), author: b.author || (s as any).name || (s as any).phone })
  return NextResponse.json({ ok: true, id: it.id, article: toArticle(it) })
}

export async function PATCH(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  if (typeof b.body === 'string') b.body = sanitize(b.body)
  const it = await updateArticle(b.id, b)
  if (!it) return NextResponse.json({ error: 'مقاله یافت نشد' }, { status: 404 })
  return NextResponse.json({ ok: true, article: toArticle(it) })
}

export async function DELETE(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'شناسه الزامی است' }, { status: 400 })
  await deleteItem(id)
  return NextResponse.json({ ok: true })
}
