import React from 'react'

interface KPICardProps {
  label: string
  value: string
  trend?: string
  trendColor?: string
  icon?: string
  iconBg?: string
  iconColor?: string
}

export default function KPICard({ label, value, trend, trendColor = 'var(--muted)', icon, iconBg = 'var(--goldDim)', iconColor = 'var(--gold)' }: KPICardProps) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 16, padding: 18
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
        {icon && (
          <span style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            {icon}
          </span>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 12, letterSpacing: '-.5px' }}>{value}</div>
      {trend && <div style={{ fontSize: 11.5, color: trendColor, marginTop: 4 }}>{trend}</div>}
    </div>
  )
}
