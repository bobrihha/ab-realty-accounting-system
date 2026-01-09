import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'

export async function GET(request: NextRequest) {
    try {
        const session = await requireSession()
        if (session.role !== 'AGENT' && session.role !== 'ROP') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const year = searchParams.get('year') ? Number(searchParams.get('year')) : new Date().getFullYear()
        const monthParam = searchParams.get('month')
        const quarterParam = searchParams.get('quarter')
        const month = monthParam && monthParam !== 'all' ? Number(monthParam) : null
        const quarter = quarterParam && quarterParam !== 'all' ? Number(quarterParam) : null

        // Определяем даты периода
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

        const whereBase = session.role === 'AGENT'
            ? { agentId: session.userId }
            : { ropId: session.userId }
        const commissionField = session.role === 'AGENT' ? 'agentCommission' : 'ropCommission'

        // 1. Итого брони (сделки в статусе DEPOSIT за период по depositDate)
        const depositsResult = await db.deal.aggregate({
            where: {
                ...whereBase,
                status: 'DEPOSIT',
                depositDate: { gte: from, lte: to }
            },
            _sum: { [commissionField]: true, commission: true },
            _count: { _all: true }
        })

        // 2. Итого сделок (закрытые сделки за период по dealDate)
        const closedResult = await db.deal.aggregate({
            where: {
                ...whereBase,
                dealDate: { gte: from, lte: to },
                NOT: { status: 'CANCELLED' }
            },
            _sum: { [commissionField]: true, commission: true },
            _count: { _all: true }
        })

        // 3. В задатках сейчас (без фильтра по дате)
        const inDepositsNow = await db.deal.aggregate({
            where: {
                ...whereBase,
                status: 'DEPOSIT'
            },
            _sum: { [commissionField]: true, commission: true },
            _count: { _all: true }
        })

        // 4. Ожидаю (сделки без dealDate, не отменены)
        const pendingResult = await db.deal.aggregate({
            where: {
                ...whereBase,
                dealDate: null,
                NOT: { status: 'CANCELLED' }
            },
            _sum: { [commissionField]: true, commission: true },
            _count: { _all: true }
        })

        // 5. Средняя ЗП за период (сумма комиссий / кол-во месяцев)
        const monthsInPeriod = month ? 1 : quarter ? 3 : 12
        const totalCommissionInPeriod = (closedResult._sum as any)[commissionField] ?? 0
        const averageSalary = monthsInPeriod > 0 ? Math.round(totalCommissionInPeriod / monthsInPeriod) : 0

        return NextResponse.json({
            role: session.role,
            filters: { year, month, quarter },
            kpi: {
                depositsInPeriod: {
                    myCommission: (depositsResult._sum as any)[commissionField] ?? 0,
                    grossCommission: depositsResult._sum.commission ?? 0,
                    count: depositsResult._count._all
                },
                closedInPeriod: {
                    myCommission: (closedResult._sum as any)[commissionField] ?? 0,
                    grossCommission: closedResult._sum.commission ?? 0,
                    count: closedResult._count._all
                },
                inDepositsNow: {
                    myCommission: (inDepositsNow._sum as any)[commissionField] ?? 0,
                    grossCommission: inDepositsNow._sum.commission ?? 0,
                    count: inDepositsNow._count._all
                },
                pending: {
                    myCommission: (pendingResult._sum as any)[commissionField] ?? 0,
                    grossCommission: pendingResult._sum.commission ?? 0,
                    count: pendingResult._count._all
                },
                averageSalary,
                monthsInPeriod
            }
        })
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error fetching agent stats:', error)
        return NextResponse.json({ error: 'Failed to fetch agent stats' }, { status: 500 })
    }
}
