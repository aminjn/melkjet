'use client'
import NeshanMap from './NeshanMap'

// نقشهٔ تکیِ ملک — حالا از نقشهٔ تعاملیِ نشان استفاده می‌کند (مثلِ بقیهٔ صفحات).
export default function PropertyMap({ lat, lng, title, price }: { lat: number; lng: number; title?: string; price?: string }) {
  return (
    <div style={{ height: 240 }}>
      <NeshanMap height={240} zoom={15} center={{ lat, lng }} points={[{ id: 'p', lat, lng, title, price }]} />
    </div>
  )
}
