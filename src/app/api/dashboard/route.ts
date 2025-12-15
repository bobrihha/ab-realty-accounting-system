import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canViewAllDeals, requireSession } from '@/lib/guards'
import { endOfMonth, startOfMonth } from '@/lib/money'

export async function GET() {
  try {
    const session = await requireSession()

    const dealsWhere: any = { NOT: { status: 'CANCELLED' } }
    if (!canViewAllDeals(session.role)) {
      if (session.role === 'AGENT') dealsWhere.agentId = session.userId
      if (session.role === 'ROP') dealsWhere.ropId = session.userId
    }

    const totals = await db.deal.aggregate({
      where: dealsWhere,
      _sum: { commission: true }
    })

    const deposits = await db.deal.aggregate({
      where: { ...dealsWhere, status: 'DEPOSIT' },
      _sum: { commission: true }
    })

    const onPayment = await db.deal.aggregate({
      where: { ...dealsWhere, status: { in: ['REGISTRATION', 'WAITING_INVOICE', 'WAITING_PAYMENT'] } },
      _sum: { commission: true }
    })

    const now = new Date()
    const from = startOfMonth(now)
    const to = endOfMonth(now)
    const netProfitMonth = await db.deal.aggregate({
      where: { ...dealsWhere, status: 'CLOSED', dealDate: { gte: from, lte: to } },
      _sum: { netProfit: true }
    })

    const recentDeals = await db.deal.findMany({
      where: dealsWhere,
      orderBy: { depositDate: 'desc' },
      take: 20,
      include: { agent: true, rop: true }
    })

    return NextResponse.json({
      kpis: {
        expectedTotal: totals._sum.commission ?? 0,
        deposits: deposits._sum.commission ?? 0,
        onPayment: onPayment._sum.commission ?? 0,
        netProfitMonth: netProfitMonth._sum.netProfit ?? 0
      },
      recentDeals
    })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching dashboard:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 })
  }
}

