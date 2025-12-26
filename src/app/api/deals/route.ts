import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, canViewAllDeals } from '@/lib/guards'
import { computeWaterfall, getRateForEmployeeAtDate } from '@/lib/commissions'
import { ensureDealPayrollAccruals } from '@/lib/payroll'

function normalizeDealExpenses<T extends { brokerExpense?: number; lawyerExpense?: number; referralExpense?: number; otherExpense?: number; externalExpenses?: number }>(
  deal: T
) {
  const brokerExpense = Number(deal.brokerExpense ?? 0)
  const lawyerExpense = Number(deal.lawyerExpense ?? 0)
  const referralExpense = Number(deal.referralExpense ?? 0)
  let otherExpense = Number(deal.otherExpense ?? 0)
  const externalExpenses = Number(deal.externalExpenses ?? 0)

  const breakdownSum = brokerExpense + lawyerExpense + referralExpense + otherExpense
  if (breakdownSum === 0 && externalExpenses !== 0) {
    otherExpense = externalExpenses
  }

  const normalizedExternal = brokerExpense + lawyerExpense + referralExpense + otherExpense
  return { brokerExpense, lawyerExpense, referralExpense, otherExpense, externalExpenses: normalizedExternal }
}

function parseOptionalNumber(value: unknown) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // DealStatus
    const agentId = searchParams.get('agentId')
    const search = searchParams.get('search')

    const where: any = {}

    if (status && status !== 'all') {
      where.status = status
    }

    if (!canViewAllDeals(session.role)) {
      if (session.role === 'AGENT') where.agentId = session.userId
      if (session.role === 'ROP') where.ropId = session.userId
    } else if (agentId && agentId !== 'all') {
      where.agentId = agentId
    }

    if (search) {
      where.OR = [
        { client: { contains: search, mode: 'insensitive' } },
        { object: { contains: search, mode: 'insensitive' } }
      ]
    }

    const deals = await db.deal.findMany({
      where,
      orderBy: { depositDate: 'desc' },
      include: { agent: true, rop: true }
    })

    return NextResponse.json(
      deals.map(d => ({
        ...d,
        ...normalizeDealExpenses(d as any)
      }))
    )
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching deals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deals' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const data = await request.json()

    const agentId = data.agentId as string
    if (!agentId) return NextResponse.json({ error: 'agentId is required' }, { status: 400 })

    const agent = await db.employee.findUnique({ where: { id: agentId } })
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const depositDate = data.depositDate ? new Date(data.depositDate) : new Date()
    const ropId = (data.ropId as string | undefined) ?? agent.managerId ?? null

    const agentRateDefault =
      (await getRateForEmployeeAtDate(agentId, 'AGENT', depositDate)) ??
      agent.baseRateAgent ??
      0

    let ropRateDefault = 0
    if (ropId) {
      const rop = await db.employee.findUnique({ where: { id: ropId } })
      if (rop) {
        ropRateDefault =
          (await getRateForEmployeeAtDate(ropId, 'ROP', depositDate)) ??
          rop.baseRateROP ??
          0
      }
    }

    const agentRateInput = parseOptionalNumber((data as any).agentRateApplied)
    const ropRateInput = parseOptionalNumber((data as any).ropRateApplied)
    const agentRate = agentRateInput === undefined || agentRateInput === null ? agentRateDefault : agentRateInput
    // Use the input ropRate if provided, otherwise fall back to default (which requires ropId)
    const ropRate =
      ropRateInput !== undefined && ropRateInput !== null
        ? ropRateInput
        : ropId
          ? ropRateDefault
          : 0

    const grossCommission = Number(data.commission ?? 0)
    const taxRate = data.taxRate === undefined || data.taxRate === null || data.taxRate === '' ? 6 : Number(data.taxRate)

    const expenses = normalizeDealExpenses({
      brokerExpense: data.brokerExpense,
      lawyerExpense: data.lawyerExpense,
      referralExpense: data.referralExpense,
      otherExpense: data.otherExpense,
      externalExpenses: data.externalExpenses
    })
    const externalExpenses = expenses.externalExpenses
    const commissionsManual = Boolean(data.commissionsManual)
    const legalServices = Boolean(data.legalServices)
    const legalServicesAmountInput = parseOptionalNumber((data as any).legalServicesAmount)
    const legalServicesAmount = legalServices ? (legalServicesAmountInput ?? 0) : 0

    const waterfall = computeWaterfall({
      grossCommission,
      taxRatePercent: taxRate,
      referralExpense: expenses.referralExpense,
      brokerExpense: expenses.brokerExpense,
      lawyerExpense: expenses.lawyerExpense,
      otherExpense: expenses.otherExpense,
      agentRatePercent: agentRate,
      ropRatePercent: ropRate
    })

    const deal = await db.deal.create({
      data: {
        client: String(data.client ?? ''),
        object: String(data.object ?? ''),
        price: Number(data.price ?? 0),
        commission: grossCommission,
        agentId,
        ropId,
        status: data.status ?? 'DEPOSIT',
        depositDate,
        dealDate: data.dealDate ? new Date(data.dealDate) : null,
        plannedCloseDate: data.plannedCloseDate ? new Date(data.plannedCloseDate) : null,
        contractType: data.contractType ?? 'EXCLUSIVE',
        legalServices,
        legalServicesAmount,
        notes: data.notes ? String(data.notes) : null,
        taxRate,
        brokerExpense: expenses.brokerExpense,
        lawyerExpense: expenses.lawyerExpense,
        referralExpense: expenses.referralExpense,
        otherExpense: expenses.otherExpense,
        externalExpenses,
        ropRateApplied: ropRate,
        agentRateApplied: agentRate,
        commissionsManual,
        ropCommission: commissionsManual ? (data.ropCommission ?? null) : waterfall.ropCommission,
        agentCommission: commissionsManual ? (data.agentCommission ?? null) : waterfall.agentCommission,
        netProfit: commissionsManual ? (data.netProfit ?? null) : waterfall.netProfit
      },
      include: { agent: true, rop: true }
    })

    await ensureDealPayrollAccruals(deal.id)
    return NextResponse.json({ ...deal, ...normalizeDealExpenses(deal as any) }, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating deal:', error)
    return NextResponse.json(
      { error: 'Failed to create deal' },
      { status: 500 }
    )
  }
}
