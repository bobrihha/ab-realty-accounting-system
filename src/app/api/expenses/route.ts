import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'
import { startOfMonth, endOfMonth } from '@/lib/money'

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (session.role === 'AGENT' || session.role === 'ROP') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month') // YYYY-MM

    const where: any = {}
    if (month) {
      const [y, m] = month.split('-').map(Number)
      const date = new Date(y, (m ?? 1) - 1, 1)
      where.date = { gte: startOfMonth(date), lte: endOfMonth(date) }
    } else if (year) {
      const y = Number(year)
      where.date = { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59, 999) }
    }

    const expenses = await db.expense.findMany({ where, orderBy: { date: 'desc' } })
    return NextResponse.json(expenses)
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}
