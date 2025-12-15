import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'

export async function GET(request: NextRequest) {
  try {
    await requireSession()
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    const rates = await db.commissionRate.findMany({
      where: employeeId ? { employeeId } : undefined,
      orderBy: { effectiveDate: 'desc' }
    })

    return NextResponse.json(rates)
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching commission rates:', error)
    return NextResponse.json({ error: 'Failed to fetch commission rates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()
    const rate = await db.commissionRate.create({
      data: {
        employeeId: String(data.employeeId ?? ''),
        rate: Number(data.rate ?? 0),
        type: String(data.type ?? 'AGENT').toUpperCase(),
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : new Date()
      }
    })

    return NextResponse.json(rate, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating commission rate:', error)
    return NextResponse.json({ error: 'Failed to create commission rate' }, { status: 500 })
  }
}
