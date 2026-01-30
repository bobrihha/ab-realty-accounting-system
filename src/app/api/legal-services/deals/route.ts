'use server'

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
        const monthKey = searchParams.get('monthKey') // формат: YYYY-MM

        if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
            return NextResponse.json({ error: 'Invalid monthKey' }, { status: 400 })
        }

        const [yearStr, monthStr] = monthKey.split('-')
        const year = parseInt(yearStr, 10)
        const month = parseInt(monthStr, 10) - 1 // JS месяцы 0-indexed

        const refDate = new Date(year, month, 1)
        const fromDate = startOfMonth(refDate)
        const toDate = endOfMonth(refDate)

        // Получаем сделки с юр.услугами за месяц
        const deals = await db.deal.findMany({
            where: {
                legalServices: true,
                dealDate: { gte: fromDate, lte: toDate }
            },
            select: {
                id: true,
                client: true,
                dealDate: true,
                legalServicesAmount: true,
                commission: true,
                price: true,
                agent: {
                    select: { name: true }
                }
            },
            orderBy: { dealDate: 'asc' }
        })

        const result = deals.map(d => ({
            id: d.id,
            client: d.client,
            dealDate: d.dealDate?.toISOString() ?? null,
            legalServicesAmount: Number(d.legalServicesAmount ?? 0),
            commission: d.commission,
            price: d.price,
            agentName: d.agent?.name ?? ''
        }))

        return NextResponse.json({
            monthKey,
            deals: result,
            totalAmount: result.reduce((acc, d) => acc + d.legalServicesAmount, 0)
        })
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error fetching legal services deals:', error)
        return NextResponse.json(
            { error: 'Failed to fetch legal services deals' },
            { status: 500 }
        )
    }
}
