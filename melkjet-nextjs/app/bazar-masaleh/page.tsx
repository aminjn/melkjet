import { redirect } from 'next/navigation'
export const revalidate = 600
export default function LegacyBazarMasaleh() { redirect('/materials-market') }
