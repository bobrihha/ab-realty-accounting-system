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
        const expenseType = searchParams.get('type') ?? 'planned' // 'planned' | 'actual'

        if (!monthKey) {
            return NextResponse.json({ error: 'monthKey is required' }, { status: 400 })
        }

        const [year, month] = monthKey.split('-').map(Number)
        const date = new Date(year, month - 1, 1)
        const from = startOfMonth(date)
        const to = endOfMonth(date)

        if (expenseType === 'actual') {
            // Фактические (оплаченные) расходы за месяц
            const actualExpenses = await db.cashFlow.findMany({
                where: {
                    type: 'EXPENSE',
                    status: 'PAID',
                    actualDate: { gte: from, lte: to }
                },
                select: {
                    id: true,
                    amount: true,
                    category: true,
                    description: true,
                    actualDate: true,
                    isRecurring: true
                },
                orderBy: { actualDate: 'asc' }
            })

            const allExpenses = actualExpenses.map(e => ({
                ...e,
                source: 'actual' as const,
                plannedDate: e.actualDate // для совместимости с UI
            }))

            const totalAmount = allExpenses.reduce((sum, e) => sum + e.amount, 0)

            return NextResponse.json({
                monthKey,
                type: 'actual',
                expenses: allExpenses,
                totalAmount
            })
        } else {
            // Плановые расходы (план)
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
                    isRecurring: true,
                    status: true,
                    accountId: true
                },
                orderBy: { plannedDate: 'asc' }
            })

            // Повторяющиеся расходы
            const recurringExpenses = await db.cashFlow.findMany({
                where: { type: 'EXPENSE', isRecurring: true },
                select: {
                    id: true,
                    amount: true,
                    category: true,
                    description: true,
                    plannedDate: true,
                    isRecurring: true,
                    status: true,
                    accountId: true
                },
                orderBy: { category: 'asc' }
            })

            // Получаем категории расходов, которые уже оплачены ЗА этот месяц
            // (проверяем по plannedDate, т.к. actualDate - это когда оплатили, а plannedDate - за какой период)
            const paidExpensesForThisMonth = await db.cashFlow.findMany({
                where: {
                    type: 'EXPENSE',
                    status: 'PAID',
                    plannedDate: { gte: from, lte: to }
                },
                select: { category: true }
            })
            const paidCategories = new Set(paidExpensesForThisMonth.map(e => e.category))

            // Фильтруем повторяющиеся расходы — исключаем те, категория которых уже оплачена
            const unpaidRecurring = recurringExpenses.filter(e => !paidCategories.has(e.category))

            const allExpenses = [
                ...unpaidRecurring.map(e => ({ ...e, source: 'recurring' as const })),
                ...plannedExpenses.map(e => ({ ...e, source: 'planned' as const }))
            ]

            const totalAmount = allExpenses.reduce((sum, e) => sum + e.amount, 0)

            return NextResponse.json({
                monthKey,
                type: 'planned',
                expenses: allExpenses,
                totalAmount
            })
        }
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error fetching expense details:', error)
        return NextResponse.json({ error: 'Failed to fetch expense details' }, { status: 500 })
    }
}

