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
        const type = searchParams.get('type') // 'INCOME' | 'EXPENSE'
        const subtype = searchParams.get('subtype') ?? 'planned' // 'planned' | 'actual'

        if (!monthKey || !type) {
            return NextResponse.json({ error: 'monthKey and type are required' }, { status: 400 })
        }

        const [year, month] = monthKey.split('-').map(Number)
        const date = new Date(year, month - 1, 1)
        const from = startOfMonth(date)
        const to = endOfMonth(date)

        const isIncome = type === 'INCOME'

        let items: any[] = []
        let totalAmount = 0

        // ---------------------------------------------------------
        // LOGIC FOR EXPENSES (Legacy + Refactored)
        // ---------------------------------------------------------
        if (!isIncome) {
            const EXCLUDED_PAYROLL_CATEGORIES = ['ЗП агентам (выплата)', 'ЗП РОП (выплата)']
            const normalizeDesc = (description: string | null) => (description ?? '').trim()
            const recurringKey = (category: string, description: string | null, amount: number) =>
                `${category}||${normalizeDesc(description)}||${Number(amount ?? 0).toFixed(2)}`
            const recurringFallbackKey = (category: string, amount: number) =>
                `${category}||${Number(amount ?? 0).toFixed(2)}`

            if (subtype === 'actual') {
                // Actual Expenses (PAID)
                const expenses = await db.cashFlow.findMany({
                    where: {
                        type: 'EXPENSE',
                        status: 'PAID',
                        actualDate: { gte: from, lte: to }
                    },
                    select: { id: true, amount: true, category: true, description: true, actualDate: true, isRecurring: true },
                    orderBy: { actualDate: 'asc' }
                })

                items = expenses.map(e => ({
                    id: e.id,
                    category: e.category,
                    description: e.description,
                    amount: e.amount,
                    date: e.actualDate,
                    source: 'cashflow',
                    status: 'PAID',
                    isRecurring: e.isRecurring
                }))
            } else {
                // Planned Expenses
                // 1. One-time planned
                const plannedExpenses = await db.cashFlow.findMany({
                    where: {
                        type: 'EXPENSE',
                        status: 'PLANNED',
                        isRecurring: false,
                        plannedDate: { gte: from, lte: to },
                        category: { notIn: EXCLUDED_PAYROLL_CATEGORIES }
                    },
                    select: { id: true, amount: true, category: true, description: true, plannedDate: true, isRecurring: true, accountId: true },
                    orderBy: { plannedDate: 'asc' }
                })

                // 2. Recurring
                const recurringExpenses = await db.cashFlow.findMany({
                    where: { type: 'EXPENSE', isRecurring: true },
                    select: { id: true, amount: true, category: true, description: true, plannedDate: true, isRecurring: true, accountId: true }
                })

                // Check what is already paid for this month (to exclude from recurring)
                const paidExpensesForThisMonth = await db.cashFlow.findMany({
                    where: {
                        type: 'EXPENSE',
                        status: 'PAID',
                        plannedDate: { gte: from, lte: to }
                    },
                    select: { category: true, description: true, amount: true }
                })
                const paidRecurringKeys = new Set(paidExpensesForThisMonth.map(e => recurringKey(e.category, e.description ?? null, e.amount)))
                const paidRecurringFallbackKeys = new Set(paidExpensesForThisMonth.map(e => recurringFallbackKey(e.category, e.amount)))

                const unpaidRecurring = recurringExpenses.filter(e => {
                    if (EXCLUDED_PAYROLL_CATEGORIES.includes(e.category)) return false
                    const key = recurringKey(e.category, e.description ?? null, e.amount)
                    const desc = normalizeDesc(e.description ?? null)
                    const isPaid = desc
                        ? paidRecurringKeys.has(key)
                        : paidRecurringKeys.has(key) || paidRecurringFallbackKeys.has(recurringFallbackKey(e.category, e.amount))
                    return !isPaid
                })

                items = [
                    ...unpaidRecurring.map(e => ({
                        id: e.id,
                        category: e.category,
                        description: e.description,
                        amount: e.amount,
                        date: e.plannedDate, // Recurring usually doesn't have a specific date in month, using generic or creation
                        source: 'recurring',
                        status: 'PLANNED',
                        isRecurring: true,
                        accountId: e.accountId
                    })),
                    ...plannedExpenses.map(e => ({
                        id: e.id,
                        category: e.category,
                        description: e.description,
                        amount: e.amount,
                        date: e.plannedDate,
                        source: 'cashflow', // planned
                        status: 'PLANNED',
                        isRecurring: false,
                        accountId: e.accountId
                    }))
                ]
            }
        }

        // ---------------------------------------------------------
        // LOGIC FOR INCOME (Deals + Manual CashFlow)
        // ---------------------------------------------------------
        else {
            if (subtype === 'actual') {
                // 1. Manual CashFlow (Fact/Paid)
                const paidIncome = await db.cashFlow.findMany({
                    where: {
                        type: 'INCOME',
                        status: 'PAID',
                        actualDate: { gte: from, lte: to }
                    },
                    select: { id: true, amount: true, netAmount: true, category: true, description: true, actualDate: true },
                    orderBy: { actualDate: 'asc' }
                })

                // 2. Closed Deals (Fact)
                // Логика: фильтрация по дате поступления денег (plannedMoneyDate)
                // Фолбэк на dealDate если plannedMoneyDate не заполнено
                const closedDeals = await db.deal.findMany({
                    where: {
                        status: 'CLOSED',
                        OR: [
                            { plannedMoneyDate: { gte: from, lte: to } },
                            { plannedMoneyDate: null, dealDate: { gte: from, lte: to } }
                        ]
                    },
                    select: { id: true, netProfit: true, client: true, dealDate: true, plannedMoneyDate: true },
                    orderBy: { dealDate: 'asc' }
                })

                // Merge
                items = [
                    ...paidIncome.map(i => ({
                        id: i.id,
                        category: i.category,
                        description: i.description,
                        amount: i.netAmount ?? i.amount, // Используем netAmount (доход) если указан
                        fullAmount: i.amount, // Полная сумма для справки
                        date: i.actualDate,
                        source: 'cashflow',
                        status: 'PAID'
                    })),
                    ...closedDeals.map(d => ({
                        id: d.id,
                        category: 'Сделка',
                        description: d.client,
                        amount: d.netProfit,
                        date: d.plannedMoneyDate ?? d.dealDate,
                        source: 'deal',
                        status: 'CLOSED'
                    }))
                ]

            } else {
                // Planned Income
                // 1. Manual CashFlow (Planned)
                const plannedIncome = await db.cashFlow.findMany({
                    where: {
                        type: 'INCOME',
                        status: 'PLANNED',
                        plannedDate: { gte: from, lte: to }
                    },
                    select: { id: true, amount: true, netAmount: true, category: true, description: true, plannedDate: true, accountId: true },
                    orderBy: { plannedDate: 'asc' }
                })

                // 2. Active Deals (Forecast)
                // Logic matching computeForecast in /api/treasury/route.ts
                const activeDeals = await db.deal.findMany({
                    where: { status: { notIn: ['CLOSED', 'CANCELLED'] } },
                    select: { id: true, netProfit: true, client: true, plannedMoneyDate: true, plannedCloseDate: true, dealDate: true }
                })

                const compareMonth = date.getMonth()
                const compareYear = date.getFullYear()

                const forecastDeals: any[] = []

                // Current month index (0-based) relative to current time isn't strictly needed here 
                // because we just check if the deal falls into *this* requested month.
                // However, we need to handle "past due" deals if this requested month is the CURRENT month.
                // If the user requests Details for May, and it is May, we should include April's overdue deals.
                // But the user might be clicking on "April" (past) in the forecast? 
                // The main forecast logic (computeForecast) puts overdue items in the FIRST month (Current Month).

                const now = new Date()
                const isCurrentMonth = compareYear === now.getFullYear() && compareMonth === now.getMonth()

                for (const d of activeDeals) {
                    const targetDate = d.plannedMoneyDate ?? d.plannedCloseDate ?? d.dealDate ?? new Date()
                    const tYear = targetDate.getFullYear()
                    const tMonth = targetDate.getMonth()

                    // Match logic: 
                    // 1. Exact match for this month
                    // 2. OR if this is the CURRENT month, include everything from the past

                    const isExactMatch = (tYear === compareYear && tMonth === compareMonth)
                    const isPastDueAndThisIsCurrentMonth = isCurrentMonth && (tYear < compareYear || (tYear === compareYear && tMonth < compareMonth))

                    if (isExactMatch || isPastDueAndThisIsCurrentMonth) {
                        forecastDeals.push({
                            id: d.id,
                            category: 'Сделка (Прогноз)',
                            description: `${d.client} ${isPastDueAndThisIsCurrentMonth ? '[Просрочка]' : ''}`,
                            amount: d.netProfit,
                            date: targetDate, // Use the target date for display
                            source: 'deal',
                            status: 'PLANNED'
                        })
                    }
                }

                items = [
                    ...plannedIncome.map(i => ({
                        id: i.id,
                        category: i.category,
                        description: i.description,
                        amount: i.netAmount ?? i.amount, // Используем netAmount (доход) если указан
                        fullAmount: i.amount, // Полная сумма для справки
                        date: i.plannedDate,
                        source: 'cashflow',
                        status: 'PLANNED',
                        accountId: i.accountId
                    })),
                    ...forecastDeals
                ]
            }
        }

        totalAmount = items.reduce((sum, i) => sum + (i.amount || 0), 0)

        // Sort by date common
        items.sort((a, b) => {
            const da = new Date(a.date).getTime()
            const db = new Date(b.date).getTime()
            return da - db
        })

        return NextResponse.json({
            monthKey,
            type,
            subtype,
            items,
            totalAmount
        })

    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error fetching treasury details:', error)
        return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 })
    }
}
