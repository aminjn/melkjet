'use client'
import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'
import PlanStudio from '@/app/components/PlanStudio'

export default function PlanAIPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 18px 70px' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--gold)', background: 'var(--goldDim)', border: '1px solid rgba(212,175,55,.25)', borderRadius: 999, padding: '5px 12px', marginBottom: 12 }}>
            <span>✦</span> استودیو پلان و سه‌بعدی AI
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>بازسازی پلان و مدل سه‌بعدی از روی عکس</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, lineHeight: 1.8 }}>چند عکس از فضا بده، قوانین را تنظیم کن — هوش مصنوعی نقشهٔ کف و مدل سه‌بعدی را می‌سازد.</p>
        </div>
        <PlanStudio />
      </main>
      <Footer />
    </div>
  )
}
