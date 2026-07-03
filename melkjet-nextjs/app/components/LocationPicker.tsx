'use client';

import { useState } from 'react';
import NeshanMap from './NeshanMap';

export interface PickResult {
  lat: number; lng: number;
  province?: string; city?: string; district?: string; neighbourhood?: string; address?: string;
}

// انتخابِ موقعیتِ ملک روی نقشهٔ «نشان» — با کلیک، آدرس/استان/شهر/منطقه/محله خودکار پر می‌شود.
// از همان NeshanMapِ سایت استفاده می‌کند (مطمئن؛ نه OpenStreetMap).
export default function LocationPicker({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick: (r: PickResult) => void }) {
  const [status, setStatus] = useState<{ kind: 'idle' | 'loading' | 'ok' | 'error'; text?: string }>({ kind: 'idle' });

  const handleClick = async (la: number, ln: number) => {
    setStatus({ kind: 'loading' });
    try {
      const r = await fetch(`/api/geo/reverse?lat=${la}&lng=${ln}`, { cache: 'no-store' });
      const d = await r.json();
      onPick({ lat: la, lng: ln, province: d.province, city: d.city, district: d.district, neighbourhood: d.neighbourhood, address: d.address });
      setStatus({ kind: 'ok', text: [d.neighbourhood, d.city].filter(Boolean).join('، ') || 'موقعیت ثبت شد' });
    } catch {
      onPick({ lat: la, lng: ln });
      setStatus({ kind: 'error', text: 'تشخیص آدرس ناموفق بود — مختصات ثبت شد' });
    }
  };

  return (
    <div>
      <div style={{ height: 280, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line2)' }}>
        <NeshanMap
          height={280}
          zoom={13}
          center={lat && lng ? { lat, lng } : undefined}
          onMapClick={handleClick}
        />
      </div>
      <div style={{ marginTop: 8, fontSize: 12.5, minHeight: 18 }}>
        {status.kind === 'loading' && <span style={{ color: 'var(--muted)' }}>در حال تشخیص آدرس…</span>}
        {status.kind === 'ok' && <span style={{ color: '#5fd98a' }}>✓ آدرس تشخیص داده شد: {status.text}</span>}
        {status.kind === 'error' && <span style={{ color: '#e7a14a' }}>{status.text}</span>}
        {status.kind === 'idle' && <span style={{ color: 'var(--faint)' }}>روی محلِ ملک روی نقشه کلیک کنید — آدرس و محله خودکار پر می‌شود.</span>}
      </div>
    </div>
  );
}
