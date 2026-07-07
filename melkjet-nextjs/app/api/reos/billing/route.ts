import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getBalance, listTransactions, listInvoices, credit, debit, createInvoice, payInvoice, type InvoiceItem } from '@/app/lib/reos/billing'

function admin(s: { role?: string; phone?: string } | null) { return !!s && (s.role === 'super_admin' || s.phone === '09122862184') }

// GET /api/reos/billing — کیفِ پول + تراکنش‌ها + فاکتورهای کاربر.
export async function GET() {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const [balance, transactions, invoices] = await Promise.all([getBalance(s.phone), listTransactions(s.phone), listInvoices(s.phone)])
  return NextResponse.json({ ok: true, balance, transactions, invoices }, { headers: { 'Cache-Control': 'no-store, private' } })
}

// POST /api/reos/billing — {action: credit(admin)|invoice|pay}
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return NextResponse.json({ error: 'وارد شوید' }, { status: 401 })
  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const a = String(b.action || '')
  if (a === 'credit') { if (!admin(s)) return NextResponse.json({ error: 'شارژ فقط توسط مدیر/درگاه' }, { status: 403 }); const owner = String(b.ownerId || s.phone); return NextResponse.json(await credit(owner, Number(b.amount) || 0, String(b.reason || 'شارژِ کیف'))) }
  if (a === 'debit') { if (!admin(s)) return NextResponse.json({ error: 'مدیر' }, { status: 403 }); return NextResponse.json(await debit(String(b.ownerId || s.phone), Number(b.amount) || 0, String(b.reason || 'برداشت'))) }
  if (a === 'invoice') { const items = (b.items as InvoiceItem[]) || []; return NextResponse.json({ ok: true, invoice: await createInvoice(s.phone, items, b.taxRate != null ? Number(b.taxRate) : undefined) }) }
  if (a === 'pay') return NextResponse.json(await payInvoice(String(b.id)))
  return NextResponse.json({ error: 'اکشن نامعتبر' }, { status: 400 })
}
