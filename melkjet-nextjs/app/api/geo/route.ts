import { NextResponse } from 'next/server'
import { getAll } from '@/app/lib/geo-store'

// Public: full geography tree (استان → شهر → منطقه → محله) for the submit form.
export async function GET() {
  return NextResponse.json({ provinces: getAll() })
}
