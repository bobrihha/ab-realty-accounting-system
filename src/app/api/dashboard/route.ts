import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canViewAllDeals, requireSession } from '@/lib/guards'

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
      _sum: { commission: true },
      _count: { _all: true }
    })

    const deposits = await db.deal.aggregate({
      where: { ...dealsWhere, status: 'DEPOSIT' },
      _sum: { commission: true },
      _count: { _all: true }
    })

    const onPayment = await db.deal.aggregate({
      where: { ...dealsWhere, status: { in: ['REGISTRATION', 'WAITING_INVOICE', 'WAITING_PAYMENT'] } },
      _sum: { commission: true },
      _count: { _all: true }
    })

    // Expected profit from active deals (not CLOSED, not CANCELLED)
    const expectedProfit = await db.deal.aggregate({
      where: { status: { notIn: ['CLOSED', 'CANCELLED'] } },
      _sum: { netProfit: true },
      _count: { _all: true }
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
        expectedProfit: expectedProfit._sum.netProfit ?? 0,
        counts: {
          expectedTotal: totals._count._all ?? 0,
          deposits: deposits._count._all ?? 0,
          onPayment: onPayment._count._all ?? 0,
          expectedProfit: expectedProfit._count._all ?? 0
        }
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
