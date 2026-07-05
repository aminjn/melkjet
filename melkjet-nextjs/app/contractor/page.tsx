'use client'
import ProDeskPage, { type ProDeskConfig } from '@/app/components/prodesk/ProDeskPage'
import { fa, money } from '@/app/components/prodesk/ProDeskKit'

// میزِ کارِ «پیمانکار»
const CFG: ProDeskConfig = {
  role: '/contractor', unit: 'پیمانکار', icon: '🛠', accent: '#d69a5c',
  recordsLabel: 'پروژه‌ها', recordsIcon: '🏗',
  directoryCategory: 'پیمانکار',
  kpis: s => [
    { label: 'مناقصه/برآوردِ باز', value: fa(s.open), accent: '#d69a5c' },
    { label: 'پروژه‌های ثبت‌شده', value: fa(s.records) },
    { label: 'تکمیل‌شده', value: fa(s.done), accent: '#34d399' },
    { label: 'ارزشِ قراردادها', value: money(s.revenue), accent: 'var(--gold)' },
  ],
  reqTerms: { title: 'درخواست‌های اجرا و مناقصه', kindLabel: 'نوعِ کار', kinds: ['ساخت از صفر', 'بازسازی', 'اسکلت', 'نازک‌کاری', 'تأسیسات'], addCta: 'درخواست/مناقصه', empty: 'هنوز درخواستی ثبت نشده.' },
  recTerms: { title: 'پروژه‌های اجرایی', kinds: ['اسکلت', 'سفت‌کاری', 'نازک‌کاری', 'محوطه'], addCta: 'پروژه', titlePh: 'نامِ پروژه', subtitlePh: 'موقعیت / متراژ', withAmount: true, empty: 'پروژه‌ای ثبت نشده.' },
  suggestions: ['یک برآوردِ اولیهٔ هزینهٔ ساختِ بنای ۲۰۰ متری بده', 'چک‌لیستِ کنترلِ کیفیتِ سفت‌کاری را بنویس', 'متنِ پیشنهادِ قیمت برای یک مناقصه بنویس', 'چطور تیمِ اجراییِ منظم بسازم؟'],
}
export default function Page() { return <ProDeskPage cfg={CFG} /> }
