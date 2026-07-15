'use client'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'

// فاز ۱۲۹ — دکمهٔ شناورِ تغییرِ تم برای پوسته‌هایی که Nav ندارند (پنل‌ها/ابزارها/ادمین)،
// تا «همه‌جای پروژه» دکمهٔ تم داشته باشد. صفحاتِ عمومی دکمه را در خودِ Nav دارند.
// استثناها: /empire (پالتِ تیرهٔ طراحی‌شدهٔ خودش را دارد — فاز ۶۱) و /pros (دکمهٔ تم در هدرِ خودش).
const SHELL_PREFIXES = ['/admin', '/agency', '/builder', '/materials', '/buyer', '/owner', '/crm', '/marketing', '/workflow', '/website-builder', '/architect', '/contractor', '/appraiser', '/lawfirm', '/finance', '/notary', '/legal', '/reos-admin']

export default function ThemeFab() {
  const path = usePathname() || ''
  if (!SHELL_PREFIXES.some(p => path === p || path.startsWith(p + '/'))) return null
  return (
    <div style={{ position: 'fixed', bottom: 14, left: 14, zIndex: 9970, boxShadow: '0 8px 24px -8px rgba(0,0,0,.45)', borderRadius: 11 }}>
      <ThemeToggle size={40} />
    </div>
  )
}
