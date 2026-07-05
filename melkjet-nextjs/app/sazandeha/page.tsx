import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
// مسیرِ قدیمیِ فارسی → /builders
export default function LegacySazandeha() { redirect('/builders') }
