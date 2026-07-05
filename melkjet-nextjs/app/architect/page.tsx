'use client'
import ProDeskPage, { type ProDeskConfig } from '@/app/components/prodesk/ProDeskPage'
import { fa, money } from '@/app/components/prodesk/ProDeskKit'

// میزِ کارِ «معمار و طراح داخلی»
const CFG: ProDeskConfig = {
  role: '/architect', unit: 'معمار و طراح', icon: '📐', accent: '#7bb0d6',
  recordsLabel: 'نمونه‌کارها', recordsIcon: '🖼',
  directoryCategory: 'معمار',
  kpis: s => [
    { label: 'استعلام‌های باز', value: fa(s.open), accent: '#7bb0d6' },
    { label: 'نمونه‌کارها', value: fa(s.records) },
    { label: 'پروژه‌های انجام‌شده', value: fa(s.done), accent: '#34d399' },
    { label: 'درآمدِ طراحی', value: money(s.revenue), accent: 'var(--gold)' },
  ],
  reqTerms: { title: 'استعلام‌های طراحی', kindLabel: 'نوعِ طراحی', kinds: ['طراحی معماری', 'طراحی داخلی', 'بازسازی', 'نظارت', 'مشاوره'], addCta: 'استعلامِ طراحی', empty: 'هنوز استعلامی ثبت نشده.' },
  recTerms: { title: 'نمونه‌کارها و پروژه‌ها', kinds: ['مسکونی', 'اداری', 'تجاری', 'ویلایی'], addCta: 'نمونه‌کار', titlePh: 'نامِ پروژه', subtitlePh: 'سبک / متراژ', withAmount: true, empty: 'نمونه‌کاری ثبت نشده — اولین پروژه‌ات را اضافه کن.' },
  suggestions: ['ایده‌های طراحیِ داخلیِ یک واحدِ ۸۵ متری بده', 'یک متنِ معرفیِ حرفه‌ای برای پروفایلم بنویس', 'برآوردِ هزینهٔ بازسازیِ آشپزخانه را توضیح بده', 'ترندهای طراحیِ داخلیِ امسال چیست؟'],
}
export default function Page() { return <ProDeskPage cfg={CFG} /> }
