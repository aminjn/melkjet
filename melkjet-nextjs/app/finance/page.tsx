'use client'
import ProDeskPage, { type ProDeskConfig } from '@/app/components/prodesk/ProDeskPage'
import { fa, money } from '@/app/components/prodesk/ProDeskKit'

// میزِ کارِ «بانک و بیمه»
const CFG: ProDeskConfig = {
  role: '/finance', unit: 'بانک و بیمه', icon: '🏦', accent: '#6fae8f',
  recordsLabel: 'محصولات و طرح‌ها', recordsIcon: '💳',
  directoryCategory: 'بیمه',
  kpis: s => [
    { label: 'درخواست‌های باز', value: fa(s.open), accent: '#6fae8f' },
    { label: 'محصولات و طرح‌ها', value: fa(s.records) },
    { label: 'تأییدشده', value: fa(s.done), accent: '#34d399' },
    { label: 'ارزشِ تسهیلات', value: money(s.revenue), accent: 'var(--gold)' },
  ],
  reqTerms: { title: 'درخواست‌های وام و بیمه', kindLabel: 'نوع', kinds: ['وامِ مسکن', 'وامِ ساخت', 'بیمهٔ آتش‌سوزی', 'بیمهٔ عمر', 'بیمهٔ مسئولیت'], addCta: 'متقاضی/درخواست', empty: 'هنوز درخواستی ثبت نشده.' },
  recTerms: { title: 'محصولات و طرح‌ها', kinds: ['تسهیلات', 'بیمه‌نامه', 'سپرده', 'ضمانت‌نامه'], addCta: 'محصول', titlePh: 'نامِ طرح', subtitlePh: 'نرخ / شرایط', withAmount: true, empty: 'محصولی ثبت نشده.' },
  suggestions: ['شرایطِ وامِ مسکنِ اوراق را خلاصه کن', 'تفاوتِ بیمهٔ آتش‌سوزیِ ساده و جامع چیست؟', 'یک متنِ معرفیِ طرحِ تسهیلاتِ ساخت بنویس', 'مدارکِ لازم برای وامِ ساخت را فهرست کن'],
}
export default function Page() { return <ProDeskPage cfg={CFG} /> }
