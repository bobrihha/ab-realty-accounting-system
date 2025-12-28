import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'
import { endOfMonth, formatMonthLabel, monthKey, startOfMonth } from '@/lib/money'

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (session.role === 'AGENT' || session.role === 'ROP') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'accounts', 'cashflow', 'forecast'
    const months = Number(searchParams.get('months') ?? 12)

    switch (type) {
      case 'accounts':
        return NextResponse.json(await db.account.findMany({ orderBy: { name: 'asc' } }))
      case 'cashflow':
        return NextResponse.json(
          await db.cashFlow.findMany({
            orderBy: { plannedDate: 'desc' },
            include: { account: true }
          })
        )
      case 'forecast':
        return NextResponse.json(await computeForecast(months))
      default:
        return NextResponse.json({
          accounts: await db.account.findMany({ orderBy: { name: 'asc' } }),
          cashFlow: await db.cashFlow.findMany({ orderBy: { plannedDate: 'desc' }, include: { account: true } }),
          forecast: await computeForecast(months)
        })
    }
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching treasury data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch treasury data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (session.role === 'AGENT' || session.role === 'ROP') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'account', 'cashflow'
    const data = await request.json()

    switch (type) {
      case 'account':
        return NextResponse.json(
          await db.account.create({
            data: {
              name: String(data.name ?? ''),
              balance: Number(data.balance ?? 0),
              type: String(data.type ?? 'BANK').toUpperCase()
            }
          }),
          { status: 201 }
        )

      case 'cashflow':
        const typeUpper = String(data.type ?? 'EXPENSE').toUpperCase() as 'INCOME' | 'EXPENSE'
        const amount = Number(data.amount ?? 0)
        const plannedDate = data.plannedDate ? new Date(data.plannedDate) : new Date()
        const statusUpper = String(data.status ?? (data.actualDate ? 'PAID' : 'PLANNED')).toUpperCase() as 'PLANNED' | 'PAID'
        const nextActualDate = statusUpper === 'PAID' ? (data.actualDate ? new Date(data.actualDate) : plannedDate) : null
        const nextAccountId = statusUpper === 'PAID' ? String(data.accountId ?? '') : (data.accountId === null ? null : data.accountId ? String(data.accountId) : null)

        if (statusUpper === 'PAID' && !nextAccountId) {
          return NextResponse.json({ error: 'accountId is required for PAID operations' }, { status: 400 })
        }

        const delta = statusUpper === 'PAID' && nextActualDate && nextAccountId ? (typeUpper === 'INCOME' ? 1 : -1) * amount : 0

        const isRecurring = typeUpper === 'EXPENSE' ? Boolean(data.isRecurring) : false

        const created = await db.$transaction(async tx => {
          const cashFlow = await tx.cashFlow.create({
            data: {
              type: typeUpper,
              amount,
              category: String(data.category ?? ''),
              status: statusUpper,
              plannedDate,
              actualDate: nextActualDate,
              description: data.description ? String(data.description) : null,
              accountId: nextAccountId,
              isRecurring
            }
          })

          if (delta !== 0) {
            await tx.account.update({
              where: { id: nextAccountId! },
              data: { balance: { increment: delta } }
            })
          }

          return cashFlow
        })

        const withAccount = await db.cashFlow.findUnique({ where: { id: created.id }, include: { account: true } })
        return NextResponse.json(withAccount, { status: 201 })

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        )
    }
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating treasury record:', error)
    return NextResponse.json(
      { error: 'Failed to create treasury record' },
      { status: 500 }
    )
  }
}

async function computeForecast(months: number) {
  const accounts = await db.account.findMany()
  let openingBalance = accounts.reduce((s, a) => s + a.balance, 0)

  const now = new Date()
  const items: any[] = []

  // "Ожидаю приход" — сумма netProfit всех активных сделок (кроме CLOSED и CANCELLED)
  // Эта сумма одинакова для всех месяцев, т.к. не привязана к плановой дате
  const expectedTotal = await db.deal.aggregate({
    where: { status: { notIn: ['CLOSED', 'CANCELLED'] } },
    _sum: { netProfit: true }
  })
  const expectedIncome = expectedTotal._sum.netProfit ?? 0

  // Повторяющиеся расходы — добавляются к каждому месяцу
  const recurringExpenses = await db.cashFlow.aggregate({
    where: { type: 'EXPENSE', isRecurring: true },
    _sum: { amount: true }
  })
  const recurringExpenseSum = recurringExpenses._sum.amount ?? 0

  for (let i = 0; i < months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const from = startOfMonth(date)
    const to = endOfMonth(date)

    const plannedExpenses = await db.cashFlow.aggregate({
      // Opening balance is taken from current account balances (includes already paid operations),
      // so for forecast we subtract only expenses that are not marked as paid yet.
      // Exclude recurring expenses here as they are added separately
      where: { type: 'EXPENSE', status: 'PLANNED', isRecurring: false, plannedDate: { gte: from, lte: to } },
      _sum: { amount: true }
    })

    // Для месяца: одноразовые плановые + все повторяющиеся
    const plannedExpenseSum = (plannedExpenses._sum.amount ?? 0) + recurringExpenseSum

    // Для первого месяца expectedIncome = полная сумма ожидаемого прихода
    // Для последующих месяцев expectedIncome = 0, т.к. уже учтён в первом месяце
    const monthExpectedIncome = i === 0 ? expectedIncome : 0
    const closingBalance = openingBalance + monthExpectedIncome - plannedExpenseSum

    const status = closingBalance < 0 ? 'critical' : 'positive'

    items.push({
      month: formatMonthLabel(monthKey(date)),
      monthKey: monthKey(date),
      openingBalance,
      expectedIncome: monthExpectedIncome,
      plannedExpenses: plannedExpenseSum,
      closingBalance,
      status
    })

    openingBalance = closingBalance
  }

  return items
}
