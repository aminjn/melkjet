'use client';

import { useEffect, useRef, useState } from 'react';

export interface PickResult {
  lat: number; lng: number;
  province?: string; city?: string; district?: string; neighbourhood?: string; address?: string;
}

// انتخابِ موقعیتِ ملک روی نقشهٔ «نشانِ استاتیک» (سمتِ سرور، مطمئن از داخلِ ایران — دقیقاً مثلِ
// نقشهٔ صفحهٔ جستجو). به SDKِ کلاینتِ نشان وابسته نیست، پس همیشه لود می‌شود.
// با کلیک روی نقشه، پیکسل → مختصات (مرکاتورِ معکوس) → آدرس/محله خودکار پر می‌شود.

const TILE = 256;
function project(lat: number, lng: number, z: number) {
  const s = TILE * Math.pow(2, z);
  const x = ((lng + 180) / 360) * s;
  const sinL = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinL) / (1 - sinL)) / (4 * Math.PI)) * s;
  return { x, y };
}
function unproject(x: number, y: number, z: number) {
  const s = TILE * Math.pow(2, z);
  const lng = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

const TEHRAN = { lat: 35.7219, lng: 51.3347 };

export default function LocationPicker({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick: (r: PickResult) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 280 });
  const [center, setCenter] = useState(lat && lng ? { lat, lng } : TEHRAN);
  const [zoom, setZoom] = useState(14);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(lat && lng ? { lat, lng } : null);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [err, setErr] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'loading' | 'ok' | 'error'; text?: string }>({ kind: 'idle' });

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => { const r = el.getBoundingClientRect(); setSize({ w: Math.min(1000, Math.max(100, Math.round(r.width / 10) * 10)), h: 280 }); };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const src = size.w > 0 ? `/api/geo/static-map?center=${center.lat.toFixed(5)},${center.lng.toFixed(5)}&w=${size.w}&h=${size.h}&zoom=${zoom}` : '';

  // پیکسلِ نقطهٔ انتخاب‌شده نسبت به مرکز
  const pinPix = picked ? (() => {
    const pc = project(center.lat, center.lng, zoom), pp = project(picked.lat, picked.lng, zoom);
    return { x: size.w / 2 + (pp.x - pc.x), y: size.h / 2 + (pp.y - pc.y) };
  })() : null;

  const reverse = async (la: number, ln: number) => {
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

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    const t = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    drag.current = { x: t.clientX, y: t.clientY, moved: false };
  };
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drag.current) return;
    const t = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    const dx = t.clientX - drag.current.x, dy = t.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
    setOff({ x: dx, y: dy });
  };
  const onUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drag.current) return;
    const { moved, x, y } = drag.current; drag.current = null;
    const t = 'changedTouches' in e ? e.changedTouches[0] : (e as React.MouseEvent);
    if (moved) {
      const dx = t.clientX - x, dy = t.clientY - y;
      const pc = project(center.lat, center.lng, zoom);
      setCenter(unproject(pc.x - dx, pc.y - dy, zoom));
      setOff({ x: 0, y: 0 });
    } else {
      // کلیک → انتخابِ موقعیت
      const r = ref.current!.getBoundingClientRect();
      const px = t.clientX - r.left, py = t.clientY - r.top;
      const pc = project(center.lat, center.lng, zoom);
      const ll = unproject(pc.x + (px - size.w / 2), pc.y + (py - size.h / 2), zoom);
      setPicked(ll); reverse(ll.lat, ll.lng);
    }
  };

  const zbtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line2)', background: 'rgba(20,18,14,0.85)', color: 'var(--text)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' };

  return (
    <div>
      <div
        ref={ref}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => { if (drag.current) { drag.current = null; setOff({ x: 0, y: 0 }); } }}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
        style={{ position: 'relative', width: '100%', height: 280, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line2)', background: 'var(--bg2)', cursor: drag.current ? 'grabbing' : 'crosshair', userSelect: 'none', touchAction: 'none' }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${off.x}px,${off.y}px)` }}>
          {src && !err ? (
            <img src={src} alt="نقشه" draggable={false} onError={() => setErr(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)', fontSize: 12.5, padding: 20, lineHeight: 1.9 }}>
              {err ? 'نقشه به «کلید نقشهٔ نشان» (web.…) نیاز دارد — پنل سوپرادمین → اتصال‌ها → نشان → کلید نقشه' : 'در حال بارگذاریِ نقشه…'}
            </div>
          )}
          {pinPix && !err && <div style={{ position: 'absolute', left: pinPix.x, top: pinPix.y, transform: 'translate(-50%,-100%)', fontSize: 30, pointerEvents: 'none', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.6))' }}>📍</div>}
        </div>
        {!err && (
          <div style={{ position: 'absolute', top: 8, insetInlineStart: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <button type="button" onClick={() => setZoom(z => Math.min(18, z + 1))} style={zbtn}>+</button>
            <button type="button" onClick={() => setZoom(z => Math.max(4, z - 1))} style={zbtn}>−</button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 12.5, minHeight: 18 }}>
        {status.kind === 'loading' && <span style={{ color: 'var(--muted)' }}>در حال تشخیص آدرس…</span>}
        {status.kind === 'ok' && <span style={{ color: '#5fd98a' }}>✓ آدرس تشخیص داده شد: {status.text}</span>}
        {status.kind === 'error' && <span style={{ color: '#e7a14a' }}>{status.text}</span>}
        {status.kind === 'idle' && <span style={{ color: 'var(--faint)' }}>روی محلِ ملک روی نقشه کلیک کنید — آدرس و محله خودکار پر می‌شود. (برای جابه‌جایی، نقشه را بکشید)</span>}
      </div>
    </div>
  );
}
