import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { listProjects, getProject, addProject, updateProject, addUnit, updateUnit, deleteUnit, addInvestor, deleteInvestor, updateMilestone, ensureImported } from '@/app/lib/builder-store'
import { builderIdForPhone, getProfile, regionLabel, phaseLabel } from '@/app/lib/persiansaze-store'
import { getPublic, patchPublic, setProjMeta, addManual, updateManual, deleteManual } from '@/app/lib/builder-public-store'
import { assembleBuilderProfile } from '@/app/lib/builder-profile'
import { getContacts } from '@/app/lib/contact-log-store'

// میز کار سازنده — per-owner: هر سازنده پروژه‌های خودش (شامل واردشده از پرشین سازه) را می‌بیند.
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ projects: [] })
  await ensureImported(s.phone)
  const url = new URL(req.url)
  const pid = url.searchParams.get('id')
  if (pid) return NextResponse.json({ project: getProject(s.phone, pid) })

  // گزارشِ تماس‌ها (کاربرانی که شمارهٔ این سازنده را دیده‌اند).
  if (url.searchParams.get('contacts') === '1') {
    const builderId = builderIdForPhone(s.phone)
    if (!builderId) return NextResponse.json({ ok: true, linked: false, contacts: [] })
    return NextResponse.json({ ok: true, linked: true, contacts: getContacts(builderId) })
  }

  // دادهٔ ویرایشِ پروفایلِ عمومی (تب «پروفایلِ عمومی» در پنل).
  if (url.searchParams.get('public') === '1') {
    const builderId = builderIdForPhone(s.phone)
    if (!builderId) return NextResponse.json({ ok: true, linked: false })
    const prof = getProfile(builderId)
    const pub = getPublic(builderId)
    const meta = pub.projMeta || {}
    const psProjects = (prof?.projects || []).map(pr => ({
      hashId: pr.hashId, address: pr.address || '', region: regionLabel(pr), phase: phaseLabel(pr),
      units: pr.units || 0, floors: pr.floors || 0, photo: (pr.photos && pr.photos[0]) || pr.photo?.imageThumbnailUrl || '',
      meta: meta[pr.hashId] || {},
    }))
    return NextResponse.json({ ok: true, linked: true, builderId, name: prof?.name || '', public: pub, psProjects, manual: pub.manual || [], preview: assembleBuilderProfile(builderId) })
  }
  return NextResponse.json({ projects: listProjects(s.phone) })
}

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'برای تغییر باید وارد شوید' }, { status: 401 })
  const o = s.phone
  const b = await req.json().catch(() => ({}))
  const a = b.action
  try {
    if (a === 'project') return NextResponse.json({ ok: true, project: addProject(o, String(b.name || 'پروژهٔ جدید'), String(b.location || '')) })
    if (a === 'updateProject') return NextResponse.json({ ok: true, project: updateProject(o, b.pid, b.patch || {}) })
    if (a === 'addUnit') return NextResponse.json({ ok: true, unit: addUnit(o, b.pid, { number: String(b.number || ''), floor: Number(b.floor) || 1, area: Number(b.area) || 0, price: Number(b.price) || 0, status: b.status || 'available', buyer: b.buyer }) })
    if (a === 'updateUnit') return NextResponse.json({ ok: true, unit: updateUnit(o, b.pid, b.uid, b.patch || {}) })
    if (a === 'deleteUnit') { deleteUnit(o, b.pid, b.uid); return NextResponse.json({ ok: true }) }
    if (a === 'addInvestor') return NextResponse.json({ ok: true, investor: addInvestor(o, b.pid, { name: String(b.name || ''), phone: b.phone, amount: Number(b.amount) || 0, units: Number(b.units) || 0 }) })
    if (a === 'deleteInvestor') { deleteInvestor(o, b.pid, b.vid); return NextResponse.json({ ok: true }) }
    if (a === 'milestone') { updateMilestone(o, b.pid, b.mid, b.status); return NextResponse.json({ ok: true }) }

    // ── پروفایلِ عمومی ──
    if (a === 'publicProfile' || a === 'projMeta' || a === 'manualAdd' || a === 'manualUpdate' || a === 'manualDelete') {
      const builderId = builderIdForPhone(o)
      if (!builderId) return NextResponse.json({ error: 'حساب شما هنوز به پایگاهِ سازنده‌ها متصل نشده است.' }, { status: 400 })
      if (a === 'publicProfile') return NextResponse.json({ ok: true, public: patchPublic(builderId, b.patch || {}) })
      if (a === 'projMeta') return NextResponse.json({ ok: true, meta: setProjMeta(builderId, String(b.hashId), b.patch || {}) })
      if (a === 'manualAdd') return NextResponse.json({ ok: true, project: addManual(builderId, b.data || {}) })
      if (a === 'manualUpdate') return NextResponse.json({ ok: true, project: updateManual(builderId, String(b.mid), b.patch || {}) })
      if (a === 'manualDelete') { deleteManual(builderId, String(b.mid)); return NextResponse.json({ ok: true }) }
    }
    return NextResponse.json({ error: 'اقدام نامعتبر' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطا' }, { status: 500 })
  }
}
