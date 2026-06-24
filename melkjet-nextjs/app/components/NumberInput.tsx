'use client'
import React from 'react'

// ورودیِ عددی با جداکنندهٔ هزارگان (برای مبالغ). مقدار را به‌صورت رشتهٔ ارقام
// لاتین نگه می‌دارد (سازگار با Number(value)) ولی با ارقام فارسی + «٬» نمایش می‌دهد.
function toLatin(s: string): string {
  return String(s)
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}
function digitsOnly(s: string): string { return toLatin(s).replace(/\D/g, '') }
function grouped(s: string): string {
  const d = digitsOnly(s)
  if (!d) return ''
  return Number(d).toLocaleString('fa-IR')
}

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string | number
  onChange: (digits: string) => void
}

export default function NumberInput({ value, onChange, ...rest }: Props) {
  return (
    <input
      {...rest}
      inputMode="numeric"
      dir="ltr"
      style={{ textAlign: 'right', ...(rest.style || {}) }}
      value={grouped(String(value ?? ''))}
      onChange={e => onChange(digitsOnly(e.target.value))}
    />
  )
}
