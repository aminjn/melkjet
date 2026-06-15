'use client'
import React from 'react'

interface BarChartProps {
  data: { value: number; label: string; color?: string }[]
  height?: number
  highlightLast?: boolean
}

export function BarChart({ data, height = 160, highlightLast = true }: BarChartProps) {
  const max = Math.max(...data.map(d => d.value))
  const min = Math.min(...data.map(d => d.value))
  return (
    <div style={{ height, display: 'flex', alignItems: 'flex-end', gap: 7 }}>
      {data.map((d, i) => {
        const pct = 20 + ((d.value - min) / (max - min || 1)) * 78
        const isLast = i === data.length - 1
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ width: '100%', borderRadius: '6px 6px 0 0', height: `${pct}%`, background: (highlightLast && isLast) || d.color ? (d.color || 'linear-gradient(to top,var(--gold),var(--gold2))') : 'var(--goldDim)', transition: '.3s' }}></div>
            <span style={{ fontSize: 10, color: 'var(--faint)', textAlign: 'center' }}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

interface LineChartProps {
  data: number[]
  width?: number
  height?: number
  color?: string
}

export function LineChart({ data, width = 400, height = 120, color = 'var(--gold)' }: LineChartProps) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 20) - 10
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((v - min) / range) * (height - 20) - 10
        return <circle key={i} cx={x} cy={y} r={i === data.length - 1 ? 5 : 3} fill={color} />
      })}
    </svg>
  )
}

interface DonutProps {
  value: number
  max?: number
  color?: string
  size?: number
  label?: string
}

export function DonutChart({ value, max = 10, color = 'var(--gold)', size = 72, label }: DonutProps) {
  const pct = value / max
  const deg = Math.round(pct * 360)
  const ring = `conic-gradient(${color} ${deg}deg, var(--line) ${deg}deg)`
  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: ring }}></div>
      <div style={{ position: 'absolute', inset: 7, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</span>
        {label && <span style={{ fontSize: 9, color: 'var(--faint)' }}>{label}</span>}
      </div>
    </div>
  )
}
