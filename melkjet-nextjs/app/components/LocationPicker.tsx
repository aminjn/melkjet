'use client';

import { useEffect, useRef, useState } from 'react';

interface PickResult { lat: number; lng: number; neighbourhood?: string; city?: string; address?: string }

declare global { interface Window { L?: any } }

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load', () => resolve(window.L)); return; }
    const s = document.createElement('script');
    s.src = LEAFLET_JS; s.async = true;
    s.onload = () => resolve(window.L);
    s.onerror = () => reject(new Error('map load failed'));
    document.body.appendChild(s);
  });
}

export default function LocationPicker({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick: (r: PickResult) => void }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [status, setStatus] = useState<{ kind: 'idle' | 'loading' | 'ok' | 'error'; text?: string }>({ kind: 'idle' });
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !elRef.current || mapRef.current) return;
      const start: [number, number] = (lat && lng) ? [lat, lng] : [35.7219, 51.3347]; // Tehran
      const map = L.map(elRef.current).setView(start, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap',
      }).addTo(map);
      mapRef.current = map;
      if (lat && lng) markerRef.current = L.marker([lat, lng]).addTo(map);

      map.on('click', async (e: any) => {
        const { lat: la, lng: ln } = e.latlng;
        if (markerRef.current) markerRef.current.setLatLng([la, ln]);
        else markerRef.current = L.marker([la, ln]).addTo(map);
        setStatus({ kind: 'loading' }); setErr('');
        try {
          const r = await fetch(`/api/geo/reverse?lat=${la}&lng=${ln}`, { cache: 'no-store' });
          const d = await r.json();
          onPick({ lat: la, lng: ln, neighbourhood: d.neighbourhood, city: d.city, address: d.address });
          setStatus({ kind: 'ok', text: d.neighbourhood || d.city || 'موقعیت ثبت شد' });
        } catch {
          onPick({ lat: la, lng: ln });
          setStatus({ kind: 'error', text: 'تشخیص محله ناموفق بود — مختصات ثبت شد' });
        }
      });
    }).catch(() => setErr('بارگذاری نقشه ناموفق بود (دسترسی اینترنت مرورگر را بررسی کنید).'));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={elRef} style={{ width: '100%', height: 280, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line2)', background: 'var(--bg2)' }} />
      <div style={{ marginTop: 8, fontSize: 12.5, minHeight: 18 }}>
        {err && <span style={{ color: '#e7674a' }}>⚠ {err}</span>}
        {!err && status.kind === 'loading' && <span style={{ color: 'var(--muted)' }}>در حال تشخیص محله…</span>}
        {!err && status.kind === 'ok' && <span style={{ color: '#5fd98a' }}>✓ محله تشخیص داده شد: {status.text}</span>}
        {!err && status.kind === 'error' && <span style={{ color: '#e7a14a' }}>{status.text}</span>}
        {!err && status.kind === 'idle' && <span style={{ color: 'var(--faint)' }}>روی نقشه کلیک کنید…</span>}
      </div>
    </div>
  );
}
