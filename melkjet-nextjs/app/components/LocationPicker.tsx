'use client';

import { useEffect, useRef, useState } from 'react';

export interface PickResult {
  lat: number; lng: number;
  province?: string; city?: string; district?: string; neighbourhood?: string; address?: string;
}

declare global { interface Window { L?: any } }

// SDKِ نشان (بر پایهٔ Leaflet) — نقشهٔ داخلیِ ایران با تشخیصِ آدرس. اگر کلید/SDK نبود، به OSM برمی‌گردیم.
const NESHAN_CSS = 'https://static.neshan.org/sdk/leaflet/1.4.0/neshan-sdk-v1.0.8/dist/index.css';
const NESHAN_JS = 'https://static.neshan.org/sdk/leaflet/1.4.0/neshan-sdk-v1.0.8/dist/index.js';
const OSM_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const OSM_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const TEHRAN: [number, number] = [35.7219, 51.3347];

function loadScript(src: string, css?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.L?.Map) return resolve(window.L);
    if (css && !document.querySelector(`link[href="${css}"]`)) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = css; document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load', () => resolve(window.L)); existing.addEventListener('error', () => reject(new Error('load failed'))); return; }
    const s = document.createElement('script'); s.src = src; s.async = true;
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

    const attachClick = (L: any, map: any) => {
      map.on('click', async (e: any) => {
        const la = e.latlng.lat, ln = e.latlng.lng;
        if (markerRef.current) markerRef.current.setLatLng([la, ln]);
        else markerRef.current = L.marker([la, ln]).addTo(map);
        setStatus({ kind: 'loading' }); setErr('');
        try {
          const r = await fetch(`/api/geo/reverse?lat=${la}&lng=${ln}`, { cache: 'no-store' });
          const d = await r.json();
          onPick({ lat: la, lng: ln, province: d.province, city: d.city, district: d.district, neighbourhood: d.neighbourhood, address: d.address });
          setStatus({ kind: 'ok', text: [d.neighbourhood, d.city].filter(Boolean).join('، ') || 'موقعیت ثبت شد' });
        } catch {
          onPick({ lat: la, lng: ln });
          setStatus({ kind: 'error', text: 'تشخیص آدرس ناموفق بود — مختصات ثبت شد' });
        }
      });
    };

    const initOSM = () => {
      loadScript(OSM_JS, OSM_CSS).then((L) => {
        if (cancelled || !elRef.current || mapRef.current) return;
        const start: [number, number] = (lat && lng) ? [lat, lng] : TEHRAN;
        const map = L.map(elRef.current).setView(start, 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
        mapRef.current = map;
        if (lat && lng) markerRef.current = L.marker([lat, lng]).addTo(map);
        attachClick(L, map);
      }).catch(() => setErr('بارگذاری نقشه ناموفق بود (اینترنت مرورگر را بررسی کنید).'));
    };

    // اول نشان (با کلیدِ نقشه)؛ اگر کلید/SDK نبود → OSM.
    fetch('/api/geo/mapkey').then(r => r.ok ? r.json() : null).then(async (d) => {
      const key = d?.key;
      if (!key) { initOSM(); return; }
      let L: any;
      try { L = await loadScript(NESHAN_JS, NESHAN_CSS); } catch { initOSM(); return; }
      if (cancelled || !elRef.current || mapRef.current) return;
      const isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
      try {
        const start = (lat && lng) ? [lat, lng] : TEHRAN;
        const map = new L.Map(elRef.current, { key, maptype: isLight ? 'standard-day' : 'standard-night', poi: true, traffic: false, center: start, zoom: 13 });
        mapRef.current = map;
        if (lat && lng) markerRef.current = L.marker([lat, lng]).addTo(map);
        attachClick(L, map);
      } catch { initOSM(); }
    }).catch(() => initOSM());

    return () => { cancelled = true; try { mapRef.current?.remove?.(); } catch {} mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={elRef} style={{ width: '100%', height: 280, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line2)', background: 'var(--bg2)' }} />
      <div style={{ marginTop: 8, fontSize: 12.5, minHeight: 18 }}>
        {err && <span style={{ color: '#e7674a' }}>⚠ {err}</span>}
        {!err && status.kind === 'loading' && <span style={{ color: 'var(--muted)' }}>در حال تشخیص آدرس…</span>}
        {!err && status.kind === 'ok' && <span style={{ color: '#5fd98a' }}>✓ آدرس تشخیص داده شد: {status.text}</span>}
        {!err && status.kind === 'error' && <span style={{ color: '#e7a14a' }}>{status.text}</span>}
        {!err && status.kind === 'idle' && <span style={{ color: 'var(--faint)' }}>روی محلِ ملک روی نقشه کلیک کنید — آدرس و محله خودکار پر می‌شود.</span>}
      </div>
    </div>
  );
}
