import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'

export async function GET() {
    try {
        await requireSession()

        // Expected total - all active deals (not CLOSED, not CANCELLED)
        const expectedTotal = await db.deal.aggregate({
            where: { status: { notIn: ['CLOSED', 'CANCELLED'] } },
            _sum: { netProfit: true },
            _count: { _all: true }
        })

        // Expected in deposits - only DEPOSIT status
        const expectedDeposits = await db.deal.aggregate({
            where: { status: 'DEPOSIT' },
            _sum: { netProfit: true },
            _count: { _all: true }
        })

        // Expected on payment - REGISTRATION, WAITING_INVOICE, WAITING_PAYMENT
        const expectedOnPayment = await db.deal.aggregate({
            where: { status: { in: ['REGISTRATION', 'WAITING_INVOICE', 'WAITING_PAYMENT'] } },
            _sum: { netProfit: true },
            _count: { _all: true }
        })

        return NextResponse.json({
            expectedTotal: {
                value: expectedTotal._sum.netProfit ?? 0,
                count: expectedTotal._count._all ?? 0
            },
            expectedDeposits: {
                value: expectedDeposits._sum.netProfit ?? 0,
                count: expectedDeposits._count._all ?? 0
            },
            expectedOnPayment: {
                value: expectedOnPayment._sum.netProfit ?? 0,
                count: expectedOnPayment._count._all ?? 0
            }
        })
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error fetching treasury KPIs:', error)
        return NextResponse.json({ error: 'Failed to fetch treasury KPIs' }, { status: 500 })
    }
}
