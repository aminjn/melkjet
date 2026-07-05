'use client'
import ProDeskPage, { type ProDeskConfig } from '@/app/components/prodesk/ProDeskPage'
import { fa, money } from '@/app/components/prodesk/ProDeskKit'

// میزِ کارِ «دفترِ حقوقی»
const CFG: ProDeskConfig = {
  role: '/lawfirm', unit: 'دفترِ حقوقی', icon: '⚖', accent: '#c98fb0',
  recordsLabel: 'پرونده‌ها', recordsIcon: '📁',
  directoryCategory: 'حقوقی',
  kpis: s => [
    { label: 'درخواست‌های باز', value: fa(s.open), accent: '#c98fb0' },
    { label: 'پرونده‌ها', value: fa(s.records) },
    { label: 'مختومه', value: fa(s.done), accent: '#34d399' },
    { label: 'درآمدِ حق‌الوکاله', value: money(s.revenue), accent: 'var(--gold)' },
  ],
  reqTerms: { title: 'درخواست‌های مشاوره و وکالت', kindLabel: 'موضوع', kinds: ['قرارداد', 'دعوای ملکی', 'اثباتِ مالکیت', 'تنظیمِ سند', 'چک و مطالبات'], addCta: 'موکل/درخواست', empty: 'هنوز درخواستی ثبت نشده.' },
  recTerms: { title: 'پرونده‌ها', kinds: ['حقوقی', 'کیفری', 'ملکی', 'قراردادی'], addCta: 'پرونده', titlePh: 'عنوانِ پرونده', subtitlePh: 'موکل / شعبه', withAmount: true, empty: 'پرونده‌ای ثبت نشده.' },
  suggestions: ['نکاتِ حقوقیِ یک مبایعه‌نامهٔ استاندارد را بگو', 'متنِ یک اظهارنامهٔ مطالبهٔ وجه بنویس', 'مراحلِ دعوای خلعِ ید چیست؟', 'چک‌لیستِ بررسیِ سندِ ملک قبل از معامله'],
}
export default function Page() { return <ProDeskPage cfg={CFG} /> }
