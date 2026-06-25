// راه‌اندازیِ پوشِ سمتِ کلاینت — ثبتِ subscription و ارسالِ آن به سرور.
// force=false ⇒ فقط اگر اجازه قبلاً داده شده، اشتراک تازه می‌شود (بدونِ پرسش). force=true ⇒ اجازه می‌پرسد.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export async function ensurePushSubscribed(force = false): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return { ok: false, reason: 'unsupported' }
    if (Notification.permission === 'denied') return { ok: false, reason: 'denied' }
    if (Notification.permission !== 'granted') {
      if (!force) return { ok: false, reason: 'default' }
      const p = await Notification.requestPermission()
      if (p !== 'granted') return { ok: false, reason: p }
    }
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      const r = await fetch('/api/push')
      const d = await r.json()
      if (!d.key) return { ok: false, reason: 'no-vapid' }
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(d.key) as BufferSource })
    }
    await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'subscribe', subscription: sub.toJSON() }) })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'error' }
  }
}
