'use client'
import ProDeskPage, { type ProDeskConfig } from '@/app/components/prodesk/ProDeskPage'
import { fa, money } from '@/app/components/prodesk/ProDeskKit'

// میزِ کارِ «دفترخانه»
const CFG: ProDeskConfig = {
  role: '/notary', unit: 'دفترخانه', icon: '◆', accent: '#b0a06f',
  recordsLabel: 'خدمات و اسناد', recordsIcon: '🧾',
  directoryCategory: 'دفترخانه',
  kpis: s => [
    { label: 'نوبت‌های باز', value: fa(s.open), accent: '#b0a06f' },
    { label: 'خدماتِ ثبت‌شده', value: fa(s.records) },
    { label: 'انجام‌شده', value: fa(s.done), accent: '#34d399' },
    { label: 'درآمد', value: money(s.revenue), accent: 'var(--gold)' },
  ],
  reqTerms: { title: 'نوبت‌ها و استعلام‌ها', kindLabel: 'نوعِ خدمت', kinds: ['تنظیمِ سند', 'وکالت‌نامه', 'تعهدنامه', 'اقرارنامه', 'استعلام'], addCta: 'نوبت/استعلام', empty: 'هنوز نوبتی ثبت نشده.' },
  recTerms: { title: 'خدمات و اسناد', kinds: ['سندِ رسمی', 'وکالت', 'تعهد', 'اقرار'], addCta: 'خدمت', titlePh: 'عنوانِ خدمت', subtitlePh: 'شرح', withAmount: true, empty: 'خدمتی ثبت نشده.' },
  suggestions: ['مدارکِ لازم برای تنظیمِ سندِ رسمیِ ملک را بگو', 'تفاوتِ وکالتِ بلاعزل و عادی چیست؟', 'مراحلِ نقل‌وانتقالِ سند در دفترخانه', 'یک متنِ راهنمای مراجعان برای پروفایلم بنویس'],
}
export default function Page() { return <ProDeskPage cfg={CFG} /> }
