'use client'
import { useState } from 'react'
import AssistantPanel from '@/app/components/AssistantPanel'
import PlansPanel from '@/app/components/PlansPanel'
import SupportPanel from '@/app/components/SupportPanel'
import BusinessProfileForm from '@/app/components/BusinessProfileForm'
import {
  Shell, useProDesk, Kpi, RequestsInbox, RecordsPanel, LoginGate, SectionCard,
  type ShellCfg, type Terms, type RecTerms, type ProStats,
} from './ProDeskKit'

// پیکربندیِ یک میزِ کارِ شغلی — هر داشبورد (معمار/پیمانکار/…) فقط این را می‌دهد.
export interface ProDeskConfig {
  role: string
  unit: string
  icon: string
  accent: string
  recordsLabel: string          // برچسبِ تبِ رکوردها (نمونه‌کارها/پرونده‌ها/محصولات/…)
  recordsIcon: string
  kpis: (s: ProStats) => { label: string; value: string; accent?: string }[]
  reqTerms: Terms
  recTerms: RecTerms
  suggestions: string[]         // پیشنهادهای دستیارِ هوشمند (مخصوصِ شغل)
  directoryCategory: string     // دستهٔ دایرکتوریِ عمومی برای «دیدنِ پروفایلم»
}

export default function ProDeskPage({ cfg }: { cfg: ProDeskConfig }) {
  const { data, authed, loading, post } = useProDesk(cfg.role)
  const [view, setView] = useState('dashboard')

  if (!loading && !authed) return <LoginGate />

  const nav = [
    { id: 'dashboard', label: 'داشبورد', icon: '▦', badge: data?.stats.open },
    { id: 'records', label: cfg.recordsLabel, icon: cfg.recordsIcon },
    { id: 'assistant', label: 'دستیار هوشمند', icon: '✨' },
    { id: 'profile', label: 'پروفایل', icon: '🪪' },
    { id: 'plans', label: 'پلن‌ها و اشتراک', icon: '👑' },
    { id: 'support', label: 'پشتیبانی', icon: '🛟' },
  ]
  const shell: ShellCfg = { dash: cfg.role, unit: cfg.unit, icon: cfg.icon, accent: cfg.accent, nav }
  const title = nav.find(n => n.id === view)?.label || 'داشبورد'

  return (
    <Shell cfg={shell} active={view} setActive={setView} title={title}>
      {!data ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>در حال بارگذاری…</div>
      ) : view === 'dashboard' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
            {cfg.kpis(data.stats).map((k, i) => <Kpi key={i} label={k.label} value={k.value} accent={k.accent} />)}
          </div>
          <RequestsInbox requests={data.requests} terms={cfg.reqTerms} post={post} />
        </>
      ) : view === 'records' ? (
        <RecordsPanel records={data.records} terms={cfg.recTerms} post={post} />
      ) : view === 'assistant' ? (
        <div style={{ height: 'calc(100vh - 150px)' }}><AssistantPanel panel={cfg.role.slice(1)} title={`دستیارِ هوشمندِ ${cfg.unit}`} subtitle="مشاورِ AI شخصیِ تو" suggestions={cfg.suggestions} /></div>
      ) : view === 'profile' ? (
        <>
          <SectionCard title="پروفایلِ عمومی" action={<a href={`/directory?category=${encodeURIComponent(cfg.directoryCategory)}`} style={{ fontSize: 12.5, color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>دیدنِ من در دایرکتوری ↗</a>}>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9 }}>پروفایلت را کامل کن تا در دایرکتوریِ «{cfg.directoryCategory}» به متقاضیان نمایش داده شوی و بتوانند مستقیم با تو تماس بگیرند.</div>
          </SectionCard>
          <BusinessProfileForm />
        </>
      ) : view === 'plans' ? (
        <PlansPanel dashboard={cfg.role} />
      ) : (
        <SupportPanel panel={cfg.role.slice(1)} />
      )}
    </Shell>
  )
}
