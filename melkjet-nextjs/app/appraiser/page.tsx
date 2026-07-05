'use client'
import ProDeskPage, { type ProDeskConfig } from '@/app/components/prodesk/ProDeskPage'
import { fa, money } from '@/app/components/prodesk/ProDeskKit'

// میزِ کارِ «کارشناسِ رسمی»
const CFG: ProDeskConfig = {
  role: '/appraiser', unit: 'کارشناسِ رسمی', icon: '📋', accent: '#8fbf7f',
  recordsLabel: 'گزارش‌ها', recordsIcon: '📄',
  directoryCategory: 'کارشناس',
  kpis: s => [
    { label: 'درخواست‌های باز', value: fa(s.open), accent: '#8fbf7f' },
    { label: 'گزارش‌های صادرشده', value: fa(s.records) },
    { label: 'انجام‌شده', value: fa(s.done), accent: '#34d399' },
    { label: 'درآمدِ کارشناسی', value: money(s.revenue), accent: 'var(--gold)' },
  ],
  reqTerms: { title: 'درخواست‌های ارزیابی', kindLabel: 'نوعِ ارزیابی', kinds: ['ارزیابیِ ملک', 'ارزیابیِ خسارت', 'تفکیک و افراز', 'تعیینِ اجاره‌بها', 'سایر'], addCta: 'درخواستِ ارزیابی', empty: 'هنوز درخواستی ثبت نشده.' },
  recTerms: { title: 'گزارش‌های کارشناسی', kinds: ['ملکی', 'خسارت', 'حقوقی', 'فنی'], addCta: 'گزارشِ جدید', titlePh: 'عنوانِ پرونده', subtitlePh: 'خلاصهٔ نظرِ کارشناسی', withAmount: true, empty: 'گزارشی ثبت نشده.' },
  suggestions: ['روشِ ارزیابیِ یک آپارتمانِ ۱۰ ساله را توضیح بده', 'ساختارِ یک گزارشِ کارشناسیِ رسمی را بنویس', 'فاکتورهای مؤثر بر ارزشِ ملک را فهرست کن', 'نحوهٔ محاسبهٔ افتِ قیمت به‌خاطرِ خسارت؟'],
}
export default function Page() { return <ProDeskPage cfg={CFG} /> }
