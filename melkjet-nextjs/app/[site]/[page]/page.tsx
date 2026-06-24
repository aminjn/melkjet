import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSite, getSitePage, sanitizeSlug, type Site } from '@/app/lib/sites-store'
import { SiteShell } from '../page'

// Sub-page renderer: melkjet.com/{site}/{page}. Named routes such as
// /property/[id], /article/[slug], /project/[id], /profile/[id] and
// /neighborhood/[id] take precedence over this dynamic [site]/[page]; this only
// catches builder-site sub-pages. 404 if the site or the page slug is unknown.

export async function generateMetadata(
  { params }: { params: Promise<{ site: string; page: string }> }
): Promise<Metadata> {
  const { site: slug, page: pageSlug } = await params
  const site = getSite(slug)
  if (!site) return {}
  const want = sanitizeSlug(pageSlug)
  const page = site.pages.find(p => p.slug === want)
  if (!page) return {}
  return {
    title: `${page.title} | ${site.seo?.title || site.title}`,
    description: site.seo?.description || undefined,
  }
}

export default async function PublishedSiteSubPage(
  { params }: { params: Promise<{ site: string; page: string }> }
) {
  const { site: slug, page: pageSlug } = await params
  const site: Site | null = getSite(slug)
  if (!site) notFound()

  // Resolve the requested page; 404 if the slug doesn't match a real page.
  const want = sanitizeSlug(pageSlug)
  const exists = site.pages.some(p => p.slug === want)
  if (!exists) notFound()

  const page = getSitePage(site, pageSlug)
  return <SiteShell site={site} page={page} />
}
