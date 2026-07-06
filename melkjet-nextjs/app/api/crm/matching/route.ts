import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getLead, listLeads, linkListing } from '@/app/lib/leads-store'
import { listItems } from '@/app/lib/scraper-store'
import { getAccount } from '@/app/lib/account-store'
import { matchListingsForLead, matchLeadsForListing } from '@/app/lib/crm-matching'

// آگهی‌های خودِ مشاور (بر اساسِ نامِ حساب). مثلِ /api/content، owner با نام تطبیق می‌شود.
async function ownerListings(phone: string) {
  const name = getAccount(phone)?.name || ''
  const all = await listItems('listing', { publicOnly: true })
  if (!name) return all.slice(0, 400)
  const n = name.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
  const mine = all.filter(i => (i.owner || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() === n)
  // اگر آگهیِ شخصی نداشت، از کلِ آگهی‌ها پیشنهاد بده (بهتر از خالی).
  return (mine.length ? mine : all).slice(0, 400)
}

// GET ?leadId= → آگهی‌های پیشنهادی برای لید | ?listingId= → لیدهای پیشنهادی برای آگهی
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const leadId = sp.get('leadId'); const listingId = sp.get('listingId')
  if (leadId) {
    const lead = await getLead(s.phone, leadId)
    if (!lead) return NextResponse.json({ error: 'لید یافت نشد' }, { status: 404 })
    const matches = matchListingsForLead(lead, await ownerListings(s.phone))
    return NextResponse.json({ matches: matches.map(m => ({ score: m.score, reasons: m.reasons, listing: { id: m.listing.id, title: m.listing.title, price: m.listing.price, location: m.listing.location, image: m.listing.image } })) })
  }
  if (listingId) {
    const it = (await listItems('listing', { publicOnly: true })).find(x => x.id === listingId)
    if (!it) return NextResponse.json({ error: 'آگهی یافت نشد' }, { status: 404 })
    const matches = matchLeadsForListing(it, await listLeads(s.phone))
    return NextResponse.json({ matches: matches.map(m => ({ score: m.score, reasons: m.reasons, lead: { id: m.lead.id, name: m.lead.name, phone: m.lead.phone, budgetText: m.lead.budgetText, stage: m.lead.stage } })) })
  }
  return NextResponse.json({ error: 'leadId یا listingId لازم است' }, { status: 400 })
}

// POST { leadId, listingId, add? } → اتصال/قطعِ آگهی به لید
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.leadId || !b.listingId) return NextResponse.json({ error: 'leadId و listingId لازم است' }, { status: 400 })
  const lead = await linkListing(s.phone, String(b.leadId), String(b.listingId), b.add !== false)
  if (!lead) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json({ lead })
}
