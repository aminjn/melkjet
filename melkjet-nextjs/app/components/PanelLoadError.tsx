'use client'
// فاز ۳۴۵ — پنلی که دادهٔ اولیه‌اش نیامد (۵۰۰/تایم‌اوت/قطعِ شبکه) قبلاً صفحهٔ «برای دسترسی وارد شوید» نشان می‌داد —
// کاربرِ واردشده گمراه می‌شد. این صفحه علتِ واقعی و «تلاشِ دوباره» دارد؛ «وارد شوید» فقط برای 401 می‌ماند.
export default function PanelLoadError({ error, onRetry, font }: { error: string; onRetry: () => void; font?: string }) {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '36px 40px', textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>اطلاعاتِ پنل بارگذاری نشد</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.9 }}>{error}</div>
        <button onClick={onRetry} style={{ background: 'var(--gold)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#1a1400', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🔄 تلاشِ دوباره</button>
      </div>
    </div>
  )
}
