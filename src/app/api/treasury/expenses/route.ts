import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'

function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export async function GET(request: NextRequest) {
    try {
        await requireSession()

        const { searchParams } = new URL(request.url)
        const monthKey = searchParams.get('monthKey') // format: "2025-12"

        if (!monthKey) {
            return NextResponse.json({ error: 'monthKey is required' }, { status: 400 })
        }

        const [year, month] = monthKey.split('-').map(Number)
        const date = new Date(year, month - 1, 1)
        const from = startOfMonth(date)
        const to = endOfMonth(date)

        // Одноразовые плановые расходы за этот месяц
        const plannedExpenses = await db.cashFlow.findMany({
            where: {
                type: 'EXPENSE',
                status: 'PLANNED',
                isRecurring: false,
                plannedDate: { gte: from, lte: to }
            },
            select: {
                id: true,
                amount: true,
                category: true,
                description: true,
                plannedDate: true,
                isRecurring: true
            },
            orderBy: { plannedDate: 'asc' }
        })

        // Повторяющиеся расходы (добавляются к каждому месяцу)
        const recurringExpenses = await db.cashFlow.findMany({
            where: { type: 'EXPENSE', isRecurring: true },
            select: {
                id: true,
                amount: true,
                category: true,
                description: true,
                plannedDate: true,
                isRecurring: true
            },
            orderBy: { category: 'asc' }
        })

        // Объединяем все расходы
        const allExpenses = [
            ...recurringExpenses.map(e => ({ ...e, source: 'recurring' as const })),
            ...plannedExpenses.map(e => ({ ...e, source: 'planned' as const }))
        ]

        const totalAmount = allExpenses.reduce((sum, e) => sum + e.amount, 0)

        return NextResponse.json({
            monthKey,
            expenses: allExpenses,
            totalAmount
        })
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error fetching expense details:', error)
        return NextResponse.json({ error: 'Failed to fetch expense details' }, { status: 500 })
    }
}
