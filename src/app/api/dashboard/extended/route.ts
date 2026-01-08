import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, canViewAllDeals } from '@/lib/guards'

function getDateRange(year: number, month?: number, quarter?: number) {
    let from: Date
    let to: Date

    if (month) {
        from = new Date(year, month - 1, 1)
        to = new Date(year, month, 0, 23, 59, 59, 999)
    } else if (quarter) {
        const startMonth = (quarter - 1) * 3
        from = new Date(year, startMonth, 1)
        to = new Date(year, startMonth + 3, 0, 23, 59, 59, 999)
    } else {
        from = new Date(year, 0, 1)
        to = new Date(year, 11, 31, 23, 59, 59, 999)
    }

    return { from, to }
}

export async function GET(request: NextRequest) {
    try {
        const session = await requireSession()

        const { searchParams } = new URL(request.url)
        const agentId = searchParams.get('agentId')
        const year = parseInt(searchParams.get('year') ?? new Date().getFullYear().toString())
        const monthParam = searchParams.get('month')
        const quarterParam = searchParams.get('quarter')
        const month = monthParam && monthParam !== 'none' ? parseInt(monthParam) : undefined
        const quarter = quarterParam && quarterParam !== 'none' ? parseInt(quarterParam) : undefined

        const baseWhere: any = { NOT: { status: 'CANCELLED' } }

        // Permission check
        if (!canViewAllDeals(session.role)) {
            if (session.role === 'AGENT') baseWhere.agentId = session.userId
            if (session.role === 'ROP') baseWhere.ropId = session.userId
        } else if (agentId && agentId !== 'all') {
            baseWhere.agentId = agentId
        }

        const { from, to } = getDateRange(year, month, quarter)

        // 1. Revenue by Deposit Date (по дате брони)
        const revenueByDeposit = await db.deal.aggregate({
            where: {
                ...baseWhere,
                depositDate: { gte: from, lte: to }
            },
            _sum: { commission: true },
            _count: { _all: true }
        })

        // 2. Revenue by Deal Date (по дате сделки)
        const revenueByDeal = await db.deal.aggregate({
            where: {
                ...baseWhere,
                dealDate: { gte: from, lte: to }
            },
            _sum: { commission: true },
            _count: { _all: true }
        })

        // 3. Deposits Revenue (в задатках) - no date filter, just status DEPOSIT
        const depositsWhere: any = { ...baseWhere, status: 'DEPOSIT' }
        if (agentId && agentId !== 'all' && canViewAllDeals(session.role)) {
            depositsWhere.agentId = agentId
        }
        const depositsRevenue = await db.deal.aggregate({
            where: depositsWhere,
            _sum: { commission: true },
            _count: { _all: true }
        })

        // 4. Pending Revenue (ожидаю) - statuses: REGISTRATION, WAITING_INVOICE, WAITING_PAYMENT
        const pendingWhere: any = {
            ...baseWhere,
            status: { in: ['REGISTRATION', 'WAITING_INVOICE', 'WAITING_PAYMENT'] }
        }
        if (agentId && agentId !== 'all' && canViewAllDeals(session.role)) {
            pendingWhere.agentId = agentId
        }
        const pendingRevenue = await db.deal.aggregate({
            where: pendingWhere,
            _sum: { commission: true },
            _count: { _all: true }
        })

        // 5. Deals per Agent - количество сделок на агента
        // Считаем по дате сделки (dealDate) за период
        const dealsForAgentMetric = await db.deal.findMany({
            where: {
                NOT: { status: 'CANCELLED' },
                dealDate: { gte: from, lte: to }
            },
            select: { agentId: true }
        })
        const uniqueAgents = new Set(dealsForAgentMetric.map(d => d.agentId))
        const totalDealsInPeriod = dealsForAgentMetric.length
        const agentCount = uniqueAgents.size
        const dealsPerAgent = agentCount > 0 ? totalDealsInPeriod / agentCount : 0

        return NextResponse.json({
            revenueByDeposit: {
                value: revenueByDeposit._sum.commission ?? 0,
                count: revenueByDeposit._count._all ?? 0
            },
            revenueByDeal: {
                value: revenueByDeal._sum.commission ?? 0,
                count: revenueByDeal._count._all ?? 0
            },
            depositsRevenue: {
                value: depositsRevenue._sum.commission ?? 0,
                count: depositsRevenue._count._all ?? 0
            },
            pendingRevenue: {
                value: pendingRevenue._sum.commission ?? 0,
                count: pendingRevenue._count._all ?? 0
            },
            dealsPerAgent: {
                value: dealsPerAgent,
                totalDeals: totalDealsInPeriod,
                agentCount: agentCount
            },
            filters: {
                year,
                month: month ?? null,
                quarter: quarter ?? null,
                agentId: agentId ?? null
            }
        })
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error fetching extended dashboard:', error)
        return NextResponse.json({ error: 'Failed to fetch extended dashboard' }, { status: 500 })
    }
}
