import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'
import { formatMonthLabel, monthKey } from '@/lib/money'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session = await requireSession()
    if (session.role === 'AGENT' || session.role === 'ROP') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const year = Number(searchParams.get('year') ?? new Date().getFullYear())
    const from = new Date(year, 0, 1)
    const to = new Date(year, 11, 31, 23, 59, 59, 999)

    const closedDeals = await db.deal.findMany({
      where: { status: 'CLOSED', dealDate: { gte: from, lte: to } },
      select: { dealDate: true, commission: true, netProfit: true }
    })

    const expenses = await db.expense.findMany({
      where: { date: { gte: from, lte: to } },
      select: { date: true, category: true, amount: true }
    })

    const byMonth: Record<
      string,
      {
        month: string
        monthKey: string
        revenue: number
        netProfitFromDeals: number
        expensesByCategory: Record<string, number>
      }
    > = {}

    for (let m = 0; m < 12; m++) {
      const mk = monthKey(new Date(year, m, 1))
      byMonth[mk] = {
        month: formatMonthLabel(mk),
        monthKey: mk,
        revenue: 0,
        netProfitFromDeals: 0,
        expensesByCategory: {}
      }
    }

    for (const d of closedDeals) {
      if (!d.dealDate) continue
      const mk = monthKey(d.dealDate)
      byMonth[mk].revenue += d.commission
      byMonth[mk].netProfitFromDeals += d.netProfit ?? 0
    }

    for (const e of expenses) {
      const mk = monthKey(e.date)
      byMonth[mk].expensesByCategory[e.category] = (byMonth[mk].expensesByCategory[e.category] ?? 0) + e.amount
    }

    const result = Object.values(byMonth)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map(m => {
        const expenseList = Object.entries(m.expensesByCategory).map(([category, amount]) => ({
          category,
          amount
        }))
        const totalExpenses = expenseList.reduce((s, x) => s + x.amount, 0)
        const profit = m.revenue - totalExpenses
        const margin = m.revenue > 0 ? (profit / m.revenue) * 100 : 0
        return {
          month: m.month,
          monthKey: m.monthKey,
          revenue: m.revenue,
          expenses: expenseList,
          totalExpenses,
          profit,
          margin,
          netProfitFromDeals: m.netProfitFromDeals
        }
      })

    return NextResponse.json(result)
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching financial data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch financial data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (session.role !== 'OWNER' && session.role !== 'ACCOUNTANT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()
    const date = data.date ? new Date(data.date) : new Date()
    const exp = await db.expense.create({
      data: {
        category: String(data.category ?? ''),
        amount: Number(data.amount ?? 0),
        date,
        description: data.description ? String(data.description) : null,
        month: monthKey(date)
      }
    })

    return NextResponse.json(exp, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error adding expense:', error)
    return NextResponse.json(
      { error: 'Failed to add expense' },
      { status: 500 }
    )
  }
}
