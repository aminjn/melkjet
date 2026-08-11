import { redirect } from 'next/navigation'
export const revalidate = 600
// مسیرِ قدیمیِ فارسی → /builders
export default function LegacySazandeha() { redirect('/builders') }
