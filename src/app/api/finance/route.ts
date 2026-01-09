import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'
import { formatMonthLabel, monthKey } from '@/lib/money'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session = await requireSession()
    if (session.role === 'AGENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const year = Number(searchParams.get('year') ?? new Date().getFullYear())
    const from = new Date(year, 0, 1)
    const to = new Date(year, 11, 31, 23, 59, 59, 999)

    const closedDeals = await db.deal.findMany({
      where: { dealDate: { gte: from, lte: to }, NOT: { status: 'CANCELLED' } },
      select: { dealDate: true, commission: true, netProfit: true }
    })

    const paidCashExpenses = await db.cashFlow.findMany({
      where: {
        type: 'EXPENSE',
        status: 'PAID',
        actualDate: { gte: from, lte: to },
        payrollPayments: { none: {} }
      },
      select: { actualDate: true, plannedDate: true, category: true, amount: true }
    })

    // NOTE: ЗП агентов и РОПов НЕ добавляем в расходы,
    // т.к. они уже вычтены в netProfit сделки (чтобы не было двойного вычета)

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

    for (const e of paidCashExpenses) {
      const date = e.actualDate ?? e.plannedDate
      const mk = monthKey(date)
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
    await requireSession()
    return NextResponse.json(
      { error: 'Расходы вводятся через Казначейство (CashFlow). Финансы — только отчет.' },
      { status: 405 }
    )
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in finance POST:', error)
    return NextResponse.json({ error: 'Failed to handle request' }, { status: 500 })
  }
}
