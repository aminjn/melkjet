'use client'
import ProDeskPage, { type ProDeskConfig } from '@/app/components/prodesk/ProDeskPage'
import { fa, money } from '@/app/components/prodesk/ProDeskKit'

// میزِ کارِ «مشاورِ حقوقی» — پنلِ واقعی (جایگزینِ صفحهٔ دموِ قبلی).
const CFG: ProDeskConfig = {
  role: '/legal', unit: 'مشاورِ حقوقی', icon: '⚖', accent: '#e0719a',
  recordsLabel: 'پرونده‌ها', recordsIcon: '📁',
  directoryCategory: 'حقوقی',
  kpis: s => [
    { label: 'مشاوره‌های باز', value: fa(s.open), accent: '#e0719a' },
    { label: 'پرونده‌ها', value: fa(s.records) },
    { label: 'مختومه', value: fa(s.done), accent: '#34d399' },
    { label: 'درآمدِ حق‌الوکاله', value: money(s.revenue), accent: 'var(--gold)' },
  ],
  reqTerms: {
    title: 'درخواست‌های مشاوره و موکل', kindLabel: 'موضوع',
    kinds: ['قرارداد', 'دعوای ملکی', 'اثباتِ مالکیت', 'تنظیمِ سند', 'چک و مطالبات', 'مشاورهٔ عمومی'],
    addCta: 'موکل/درخواست', empty: 'هنوز درخواستی ثبت نشده.',
  },
  recTerms: {
    title: 'پرونده‌ها', kinds: ['حقوقی', 'کیفری', 'ملکی', 'قراردادی'],
    addCta: 'پرونده', titlePh: 'عنوانِ پرونده', subtitlePh: 'موکل / شعبه', withAmount: true, empty: 'پرونده‌ای ثبت نشده.',
  },
  suggestions: [
    'نکاتِ حقوقیِ یک مبایعه‌نامهٔ استاندارد را بگو',
    'متنِ یک اظهارنامهٔ مطالبهٔ وجه بنویس',
    'مراحلِ دعوای خلعِ ید چیست؟',
    'چک‌لیستِ بررسیِ سندِ ملک قبل از معامله',
  ],
}
export default function LegalPage() { return <ProDeskPage cfg={CFG} /> }
