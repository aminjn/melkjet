import Nav from '@/app/components/Nav'
import Footer from '@/app/components/Footer'

export const metadata = { title: 'قوانین و شرایط استفاده' }

const sections = [
  { h: '۱. پذیرش شرایط', p: 'با استفاده از ملک‌جت، کاربر می‌پذیرد که از خدمات مطابق این قوانین و مقررات جمهوری اسلامی ایران استفاده کند.' },
  { h: '۲. صحت اطلاعات آگهی', p: 'مسئولیت صحت اطلاعات آگهی بر عهدهٔ ثبت‌کنندهٔ آن است. ملک‌جت با کمک هوش مصنوعی آگهی‌ها را بررسی می‌کند اما تضمین‌کنندهٔ معامله نیست.' },
  { h: '۳. حریم خصوصی', p: 'اطلاعات کاربران تنها برای ارائهٔ خدمات استفاده می‌شود و بدون اجازه در اختیار شخص ثالث قرار نمی‌گیرد.' },
  { h: '۴. محتوای تولیدشده', p: 'محتوای تولیدشده توسط کاربران یا ابزارهای هوش مصنوعی نباید خلاف قانون، توهین‌آمیز یا گمراه‌کننده باشد. ملک‌جت حق حذف چنین محتوایی را دارد.' },
  { h: '۵. مسئولیت معاملات', p: 'ملک‌جت بستر ارتباط است و در معاملات بین کاربران دخالت مستقیم ندارد؛ توصیه می‌شود پیش از هر معامله بررسی‌های لازم انجام شود.' },
  { h: '۶. تغییر قوانین', p: 'ملک‌جت می‌تواند این قوانین را به‌روزرسانی کند؛ نسخهٔ جاری همواره در همین صفحه در دسترس است.' },
]

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Nav />
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 18px 70px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20 }}>قوانین و شرایط استفاده</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map(s => (
            <div key={s.h} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--gold)' }}>{s.h}</div>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 2, margin: 0 }}>{s.p}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
