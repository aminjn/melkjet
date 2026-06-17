'use client'
import { useEffect, useRef } from 'react'

declare global { interface Window { L?: any } }
const CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'

function load(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L)
    if (!document.querySelector(`link[href="${CSS}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; document.head.appendChild(l) }
    const ex = document.querySelector(`script[src="${JS}"]`) as HTMLScriptElement | null
    if (ex) { ex.addEventListener('load', () => resolve(window.L)); return }
    const s = document.createElement('script'); s.src = JS; s.async = true
    s.onload = () => resolve(window.L); s.onerror = () => reject(new Error('map'))
    document.body.appendChild(s)
  })
}

export default function PropertyMap({ lat, lng }: { lat: number; lng: number }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  useEffect(() => {
    let dead = false
    load().then(L => {
      if (dead || !el.current || map.current) return
      const m = L.map(el.current, { scrollWheelZoom: false }).setView([lat, lng], 15)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m)
      L.circle([lat, lng], { radius: 350, color: 'var(--gold)', fillColor: 'var(--gold)', fillOpacity: 0.15 }).addTo(m)
      map.current = m
    }).catch(() => {})
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <div ref={el} style={{ width: '100%', height: 280, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--bg2)' }} />
}
