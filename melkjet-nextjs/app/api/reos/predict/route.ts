import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { predictLeadConversion, predictPropertyDemand, predictAgentPerformance, optimizePrice } from '@/app/lib/reos/ml'
import { orchestrateBuyerJourney } from '@/app/lib/reos/orchestrator'
import { loadUser, loadProperties, loadAgentsForAgency, itemToProperty } from '@/app/lib/reos/data'
import { getItemById } from '@/app/lib/scraper-store'

// POST /api/reos/predict  {kind, ...}
// kind: conversion | demand | agent | price | journey
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const kind = String(b.kind || '')

  if (kind === 'conversion') {
    return NextResponse.json({ ok: true, prediction: predictLeadConversion(b.lead || {}, b.agent) })
  }
  if (kind === 'demand') {
    const it = b.propertyId ? await getItemById(String(b.propertyId)) : null
    const p = it ? itemToProperty(it) : (b.property || {})
    return NextResponse.json({ ok: true, prediction: predictPropertyDemand(p) })
  }
  if (kind === 'agent') {
    return NextResponse.json({ ok: true, prediction: predictAgentPerformance(b.agent || {}) })
  }
  if (kind === 'price') {
    const it = b.propertyId ? await getItemById(String(b.propertyId)) : null
    const p = it ? itemToProperty(it) : (b.property || {})
    return NextResponse.json({ ok: true, prediction: optimizePrice(p, b.market || {}) })
  }
  if (kind === 'journey') {
    // سفرِ خریدار (Orchestrator): تطبیقِ ملک + بهترین مشاور + مالی + cross-sell + ارزشِ لید
    const [user, properties] = await Promise.all([loadUser(s.phone), loadProperties(300)])
    const agents = b.agencyPhone ? await loadAgentsForAgency(String(b.agencyPhone)) : []
    const journey = orchestrateBuyerJourney(user, properties, agents, { monthlyIncome: Number(b.monthlyIncome) || 0, regionDemand: Number(b.regionDemand) || 0.5 })
    return NextResponse.json({ ok: true, journey })
  }
  return NextResponse.json({ error: 'kind نامعتبر (conversion|demand|agent|price|journey)' }, { status: 400 })
}
