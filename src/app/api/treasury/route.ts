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
    const yearParam = searchParams.get('year')
    const year = yearParam ? Number(yearParam) : null // null means current/future view

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
        return NextResponse.json(await computeForecast(months, year))
      default:
        return NextResponse.json({
          accounts: await db.account.findMany({ orderBy: { name: 'asc' } }),
          cashFlow: await db.cashFlow.findMany({ orderBy: { plannedDate: 'desc' }, include: { account: true } }),
          forecast: await computeForecast(months, year)
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

async function computeForecast(months: number, year: number | null = null) {
  const accounts = await db.account.findMany()
  let openingBalance = accounts.reduce((s, a) => s + a.balance, 0)

  const now = new Date()
  const isHistoricalView = year !== null && year < now.getFullYear()
  const items: any[] = []

  // Категории расходов, которые НЕ учитываются в прогнозе,
  // т.к. netProfit сделок уже учтена за вычетом комиссий агентов/РОП
  const EXCLUDED_PAYROLL_CATEGORIES = ['ЗП агентам (выплата)', 'ЗП РОП (выплата)']

  // Для исторического просмотра (прошлый год) считаем доход из закрытых сделок по месяцам
  // Для прогноза — сумма netProfit всех активных сделок
  let expectedIncomeForForecast = 0
  if (!isHistoricalView) {
    const expectedTotal = await db.deal.aggregate({
      where: { status: { notIn: ['CLOSED', 'CANCELLED'] } },
      _sum: { netProfit: true }
    })
    expectedIncomeForForecast = expectedTotal._sum.netProfit ?? 0
  }

  // Повторяющиеся расходы — загружаем список для проверки по категориям
  // Исключаем ЗП агентам/РОП - уже учтены в netProfit
  const recurringExpensesList = await db.cashFlow.findMany({
    where: {
      type: 'EXPENSE',
      isRecurring: true,
      category: { notIn: EXCLUDED_PAYROLL_CATEGORIES }
    },
    select: { id: true, category: true, amount: true }
  })

  // Определяем стартовый месяц
  const startYear = year ?? now.getFullYear()
  const startMonth = isHistoricalView ? 0 : now.getMonth() // Для прошлого года — с января, для текущего — с текущего месяца
  const monthsToShow = isHistoricalView ? 12 : months

  for (let i = 0; i < monthsToShow; i++) {
    const date = new Date(startYear, startMonth + i, 1)
    const from = startOfMonth(date)
    const to = endOfMonth(date)

    const plannedExpenses = await db.cashFlow.aggregate({
      // Exclude recurring expenses here as they are added separately
      // Exclude payroll categories - already accounted in netProfit
      where: {
        type: 'EXPENSE',
        status: 'PLANNED',
        isRecurring: false,
        plannedDate: { gte: from, lte: to },
        category: { notIn: EXCLUDED_PAYROLL_CATEGORIES }
      },
      _sum: { amount: true }
    })

    // Факт расходов за месяц (оплаченные)
    const actualExpenses = await db.cashFlow.aggregate({
      where: {
        type: 'EXPENSE',
        status: 'PAID',
        actualDate: { gte: from, lte: to },
        category: { notIn: EXCLUDED_PAYROLL_CATEGORIES }
      },
      _sum: { amount: true }
    })

    // Получаем категории расходов, оплаченных ЗА этот месяц (по plannedDate, не actualDate)
    const paidExpensesForThisMonth = await db.cashFlow.findMany({
      where: {
        type: 'EXPENSE',
        status: 'PAID',
        plannedDate: { gte: from, lte: to }
      },
      select: { category: true }
    })
    const paidCategories = new Set(paidExpensesForThisMonth.map(e => e.category))

    // Считаем сумму повторяющихся расходов, исключая те категории, которые уже оплачены
    let recurringExpenseSum = 0
    for (const re of recurringExpensesList) {
      if (!paidCategories.has(re.category)) {
        recurringExpenseSum += re.amount
      }
    }

    // Для месяца: одноразовые плановые + повторяющиеся (не оплаченные)
    const plannedExpenseSum = (plannedExpenses._sum.amount ?? 0) + recurringExpenseSum

    // Факт расходов ЗА этот месяц (по plannedDate — за какой период оплачено)
    // Исключаем ЗП агентам/РОП - уже учтены в netProfit
    const actualExpensesForThisMonth = await db.cashFlow.aggregate({
      where: {
        type: 'EXPENSE',
        status: 'PAID',
        plannedDate: { gte: from, lte: to },
        category: { notIn: EXCLUDED_PAYROLL_CATEGORIES }
      },
      _sum: { amount: true }
    })
    const actualExpenseForPeriod = actualExpensesForThisMonth._sum.amount ?? 0

    // actualExpenses по дате оплаты (для отображения в колонке "Факт расходов")
    const actualExpenseSum = actualExpenses._sum.amount ?? 0

    // Расчёт дохода для месяца
    let monthExpectedIncome = 0
    if (isHistoricalView) {
      // Для исторического просмотра: берём сумму netProfit закрытых сделок за этот месяц
      const closedDealsInMonth = await db.deal.aggregate({
        where: {
          dealDate: { gte: from, lte: to },
          status: 'CLOSED'
        },
        _sum: { netProfit: true }
      })
      monthExpectedIncome = closedDealsInMonth._sum.netProfit ?? 0
    } else {
      // Для прогноза: весь ожидаемый доход показываем в первом месяце
      monthExpectedIncome = i === 0 ? expectedIncomeForForecast : 0
    }

    // Закрытие = Открытие + Ожидаемый приход - План расходов
    // (Факт расходов НЕ вычитаем, т.к. он уже уменьшил баланс счетов при оплате)
    const closingBalance = openingBalance + monthExpectedIncome - plannedExpenseSum

    const status = closingBalance < 0 ? 'critical' : 'positive'

    items.push({
      month: formatMonthLabel(monthKey(date)),
      monthKey: monthKey(date),
      openingBalance,
      expectedIncome: monthExpectedIncome,
      plannedExpenses: plannedExpenseSum,
      actualExpenses: actualExpenseSum,
      closingBalance,
      status
    })

    openingBalance = closingBalance
  }

  return items
}
