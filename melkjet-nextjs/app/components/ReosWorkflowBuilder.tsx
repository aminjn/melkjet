'use client'
import { useEffect, useState } from 'react'

// سازندهٔ گردش‌کارِ IF/THEN (REOS Workflow Builder). به /api/reos/workflow وصل است.
const FONT = 'Vazirmatn, system-ui, sans-serif'
type Cond = { field: string; op: string; value: string }
type Act = { type: string; param: string }
type Wf = { id: string; name: string; trigger: string; conditions: { field: string; op: string; value: string | number }[]; actions: { type: string; params: Record<string, unknown> }[]; active: boolean; runs: number }

const TRIGGERS = [['lead_idle', 'لید خوابیده'], ['lead_created', 'لیدِ جدید'], ['stage_changed', 'تغییرِ مرحله']]
const FIELDS = [['idleDays', 'روزهای بی‌فعالیت'], ['stage', 'مرحله'], ['score', 'امتیاز'], ['source', 'منبع'], ['tags', 'تگ']]
const OPS = [['gte', '≥'], ['lte', '≤'], ['eq', '='], ['neq', '≠'], ['contains', 'شامل']]
const ACTIONS = [['create_task', 'ساختِ تسک'], ['move_stage', 'جابه‌جاییِ مرحله'], ['send_sms', 'ارسالِ پیامک'], ['add_activity', 'ثبتِ یادداشت'], ['increase_priority', 'افزایشِ اولویت']]
const paramKeyOf = (t: string) => t === 'create_task' ? 'title' : t === 'move_stage' ? 'toStage' : 'text'

export default function ReosWorkflowBuilder() {
  const [list, setList] = useState<Wf[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState('lead_idle')
  const [conds, setConds] = useState<Cond[]>([{ field: 'idleDays', op: 'gte', value: '3' }])
  const [acts, setActs] = useState<Act[]>([{ type: 'create_task', param: 'پیگیریِ لید' }])
  const [busy, setBusy] = useState(false)

  const load = () => fetch('/api/reos/workflow', { cache: 'no-store' }).then(r => r.ok ? r.json() : { workflows: [] }).then(d => setList(d.workflows || [])).catch(() => {})
  useEffect(() => { load() }, [])

  const save = async () => {
    setBusy(true)
    const conditions = conds.filter(c => c.value !== '').map(c => ({ field: c.field, op: c.op, value: c.field === 'idleDays' || c.field === 'score' ? Number(c.value) : c.value }))
    const actions = acts.map(a => ({ type: a.type, params: { [paramKeyOf(a.type)]: a.param } }))
    await fetch('/api/reos/workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', name: name || 'گردش‌کار', trigger, conditions, actions }) }).catch(() => {})
    setBusy(false); setOpen(false); setName(''); load()
  }
  const toggle = async (id: string, active: boolean) => { await fetch('/api/reos/workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle', id, active }) }); load() }
  const run = async (t: string) => { await fetch('/api/reos/workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run', trigger: t }) }); load() }

  const sel = (v: string, set: (x: string) => void, opts: string[][]) => <select value={v} onChange={e => set(e.target.value)} style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12 }}>{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
  const inp = (v: string, set: (x: string) => void, ph = '') => <input value={v} onChange={e => set(e.target.value)} placeholder={ph} style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line2)', background: 'var(--bg2)', color: 'var(--text)', fontFamily: FONT, fontSize: 12, minWidth: 90 }} />

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, fontFamily: FONT, direction: 'rtl' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>⚙️</span><span style={{ fontSize: 15, fontWeight: 800 }}>سازندهٔ گردش‌کار (اتوماسیون)</span>
        <button onClick={() => setOpen(o => !o)} style={{ marginInlineStart: 'auto', padding: '6px 13px', borderRadius: 9, border: '1px solid var(--gold)', background: 'var(--goldDim)', color: 'var(--gold)', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 12.5 }}>{open ? 'بستن' : '+ گردش‌کارِ جدید'}</button>
      </div>

      {open && (
        <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 14, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{inp(name, setName, 'نامِ گردش‌کار')}<span style={{ fontSize: 12, color: 'var(--muted)' }}>وقتی:</span>{sel(trigger, setTrigger, TRIGGERS)}</div>
          <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>اگر (شرط‌ها):</div>
          {conds.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {sel(c.field, v => setConds(cs => cs.map((x, j) => j === i ? { ...x, field: v } : x)), FIELDS)}
              {sel(c.op, v => setConds(cs => cs.map((x, j) => j === i ? { ...x, op: v } : x)), OPS)}
              {inp(c.value, v => setConds(cs => cs.map((x, j) => j === i ? { ...x, value: v } : x)), 'مقدار')}
              <button onClick={() => setConds(cs => cs.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setConds(cs => [...cs, { field: 'stage', op: 'eq', value: '' }])} style={{ alignSelf: 'flex-start', fontSize: 11.5, padding: '4px 10px', borderRadius: 8, border: '1px dashed var(--line2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: FONT }}>+ شرط</button>
          <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>آنگاه (اقدام‌ها):</div>
          {acts.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {sel(a.type, v => setActs(as => as.map((x, j) => j === i ? { ...x, type: v } : x)), ACTIONS)}
              {inp(a.param, v => setActs(as => as.map((x, j) => j === i ? { ...x, param: v } : x)), 'مقدار/متن')}
              <button onClick={() => setActs(as => as.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setActs(as => [...as, { type: 'send_sms', param: '' }])} style={{ alignSelf: 'flex-start', fontSize: 11.5, padding: '4px 10px', borderRadius: 8, border: '1px dashed var(--line2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: FONT }}>+ اقدام</button>
          <button onClick={save} disabled={busy} style={{ alignSelf: 'flex-start', marginTop: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(140deg,var(--gold2),var(--gold))', color: '#16140f', fontWeight: 800, cursor: 'pointer', fontFamily: FONT }}>{busy ? 'ذخیره…' : 'ذخیرهٔ گردش‌کار'}</button>
        </div>
      )}

      {list.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>هنوز گردش‌کاری نساخته‌اید.</div> :
        list.map(w => (
          <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--line)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: w.active ? '#34d399' : 'var(--faint)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{w.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{TRIGGERS.find(t => t[0] === w.trigger)?.[1]} · {w.conditions.length} شرط · {w.actions.length} اقدام · {(w.runs || 0).toLocaleString('fa-IR')} اجرا</div>
            </div>
            <button onClick={() => run(w.trigger)} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 7, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: FONT }}>اجرا</button>
            <button onClick={() => toggle(w.id, !w.active)} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 7, border: '1px solid var(--line2)', background: 'transparent', color: w.active ? '#e7a14a' : '#34d399', cursor: 'pointer', fontFamily: FONT }}>{w.active ? 'توقف' : 'فعال'}</button>
          </div>
        ))}
    </div>
  )
}
