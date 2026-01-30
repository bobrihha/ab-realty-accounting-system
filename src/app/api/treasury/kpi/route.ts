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

        // 1. Ожидаю на оплате (WAITING_PAYMENT)
        const expectedWaitingPayment = await db.deal.aggregate({
            where: { status: 'WAITING_PAYMENT' },
            _sum: { netProfit: true },
            _count: { _all: true }
        })

        // 2. Ожидаю на регистрации (REGISTRATION)
        const expectedRegistration = await db.deal.aggregate({
            where: { status: 'REGISTRATION' },
            _sum: { netProfit: true },
            _count: { _all: true }
        })

        // 3. Ожидаю на выставлении счета (WAITING_INVOICE)
        const expectedWaitingInvoice = await db.deal.aggregate({
            where: { status: 'WAITING_INVOICE' },
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
            expectedWaitingPayment: {
                value: expectedWaitingPayment._sum.netProfit ?? 0,
                count: expectedWaitingPayment._count._all ?? 0
            },
            expectedRegistration: {
                value: expectedRegistration._sum.netProfit ?? 0,
                count: expectedRegistration._count._all ?? 0
            },
            expectedWaitingInvoice: {
                value: expectedWaitingInvoice._sum.netProfit ?? 0,
                count: expectedWaitingInvoice._count._all ?? 0
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
