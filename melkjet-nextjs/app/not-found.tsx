import Link from 'next/link'
import Nav from './components/Nav'
import Footer from './components/Footer'

// صفحهٔ ۴۰۴ سفارشی.
// چرا این فایل «باید» وجود داشته باشد: بدونِ not-found.tsx، Next.js با Turbopack
// مانیفستِ کلاینتِ route پیش‌فرضِ «/_not-found» را نمی‌سازد و هر ۴۰۴ (ربات، لینکِ
// قدیمی، چانکِ گم‌شده) هنگامِ رندر «InvariantError: client reference manifest …
// does not exist» می‌دهد و اینستنس را کرش/ری‌استارت می‌کند. داشتنِ یک not-found
// سفارشی، ساختِ درستِ مانیفست را تضمین می‌کند و این کرش‌ها را برای همیشه می‌بندد.

export default function NotFound() {
  return (
    <>
      <Nav />
      <main style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 72, fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>۴۰۴</div>
        <div style={{ fontSize: 19, fontWeight: 700 }}>صفحه پیدا نشد</div>
        <div style={{ color: 'var(--muted)', fontSize: 14, maxWidth: 420 }}>
          این نشانی وجود ندارد، منتقل شده یا حذف شده است. از خانه دوباره شروع کنید.
        </div>
        <Link href="/" style={{ marginTop: 8, background: 'var(--gold)', color: '#1a1a1a', padding: '11px 26px', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
          بازگشت به خانه
        </Link>
      </main>
      <Footer />
    </>
  )
}
