import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import {
  getAll, addProvince, addCity, addDistrict, addNeighborhood,
  renameNode, deleteNode,
} from '@/app/lib/geo-store'

async function guard() {
  const s = await getSession()
  return s && s.role === 'super_admin'
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  return NextResponse.json({ provinces: getAll() })
}

// POST { action, ...payload }
export async function POST(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
  const b = await req.json()
  const name = b.name ? String(b.name).slice(0, 60).trim() : ''
  let provinces
  switch (b.action) {
    case 'addProvince': if (!name) return bad(); provinces = addProvince(name); break
    case 'addCity': if (!name || !b.pid) return bad(); provinces = addCity(b.pid, name); break
    case 'addDistrict': if (!name || !b.pid || !b.cid) return bad(); provinces = addDistrict(b.pid, b.cid, name); break
    case 'addNeighborhood': if (!name || !b.pid || !b.cid || !b.did) return bad(); provinces = addNeighborhood(b.pid, b.cid, b.did, name); break
    case 'rename': if (!name || !b.level || !b.pid) return bad(); provinces = renameNode(b.level, { pid: b.pid, cid: b.cid, did: b.did }, name); break
    case 'delete': if (!b.level || !b.pid) return bad(); provinces = deleteNode(b.level, { pid: b.pid, cid: b.cid, did: b.did, name: b.name }); break
    default: return bad()
  }
  return NextResponse.json({ ok: true, provinces })
}

function bad() { return NextResponse.json({ error: 'ورودی نامعتبر' }, { status: 400 }) }
