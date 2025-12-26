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

async function resolveAppliedRates(params: {
  agentId: string
  ropId: string | null
  depositDate: Date
  agentRateInput: number | null | undefined
  ropRateInput: number | null | undefined
  existingAgentRate: number | null
  existingRopRate: number | null
}) {
  const agent = await db.employee.findUnique({ where: { id: params.agentId } })
  const agentRateDefault =
    agent &&
    ((await getRateForEmployeeAtDate(params.agentId, 'AGENT', params.depositDate)) ??
      agent.baseRateAgent ??
      0)
  const agentRate =
    params.agentRateInput === undefined
      ? params.existingAgentRate ?? agentRateDefault ?? 0
      : params.agentRateInput === null
        ? agentRateDefault ?? 0
        : params.agentRateInput

  let ropRateDefault = 0
  if (params.ropId) {
    const rop = await db.employee.findUnique({ where: { id: params.ropId } })
    if (rop) {
      ropRateDefault =
        (await getRateForEmployeeAtDate(params.ropId, 'ROP', params.depositDate)) ??
        rop.baseRateROP ??
        0
    }
  }
  const ropRate =
    params.ropRateInput !== undefined && params.ropRateInput !== null
      ? params.ropRateInput
      : params.ropId
        ? params.existingRopRate ?? ropRateDefault
        : params.existingRopRate ?? 0

  return { agentRate, ropRate }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    const { id } = await params

    const deal = await db.deal.findUnique({
      where: { id },
      include: { agent: true, rop: true }
    })

    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    if (!canViewAllDeals(session.role)) {
      if (session.role === 'AGENT' && deal.agentId !== session.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (session.role === 'ROP' && deal.ropId !== session.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({ ...deal, ...normalizeDealExpenses(deal as any) })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching deal:', error)
    return NextResponse.json(
      { error: 'Failed to fetch deal' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const existing = await db.deal.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    const data = await request.json()
    const commissionsManual =
      typeof data.commissionsManual === 'boolean' ? data.commissionsManual : existing.commissionsManual
    const legalServicesInput = typeof data.legalServices === 'boolean' ? data.legalServices : undefined
    const legalServicesAmountInput = parseOptionalNumber((data as any).legalServicesAmount)

    const agentRateInput = parseOptionalNumber((data as any).agentRateApplied)
    const ropRateInput = parseOptionalNumber((data as any).ropRateApplied)

    const expenses = normalizeDealExpenses({
      brokerExpense: data.brokerExpense ?? existing.brokerExpense,
      lawyerExpense: data.lawyerExpense ?? existing.lawyerExpense,
      referralExpense: data.referralExpense ?? existing.referralExpense,
      otherExpense: data.otherExpense ?? existing.otherExpense,
      externalExpenses: data.externalExpenses ?? existing.externalExpenses
    })

    let update: any = {
      client: data.client ?? undefined,
      object: data.object ?? undefined,
      price: data.price ?? undefined,
      commission: data.commission ?? undefined,
      agentId: data.agentId ?? undefined,
      status: data.status ?? undefined,
      depositDate: data.depositDate ? new Date(data.depositDate) : undefined,
      dealDate: data.dealDate ? new Date(data.dealDate) : data.dealDate === null ? null : undefined,
      plannedCloseDate: data.plannedCloseDate
        ? new Date(data.plannedCloseDate)
        : data.plannedCloseDate === null
          ? null
          : undefined,
      contractType: data.contractType ?? undefined,
      legalServices: legalServicesInput ?? undefined,
      notes: data.notes === null ? null : data.notes ?? undefined,
      taxRate: data.taxRate ?? undefined,
      brokerExpense: data.brokerExpense ?? undefined,
      lawyerExpense: data.lawyerExpense ?? undefined,
      referralExpense: data.referralExpense ?? undefined,
      otherExpense: data.otherExpense ?? undefined,
      externalExpenses: expenses.externalExpenses,
      commissionsManual
    }

    if ((data.status ?? existing.status) === 'CLOSED' && update.dealDate === undefined && !existing.dealDate) {
      update.dealDate = new Date()
    }

    const shouldRecalc =
      !commissionsManual &&
      (data.commission !== undefined ||
        data.taxRate !== undefined ||
        data.externalExpenses !== undefined ||
        data.brokerExpense !== undefined ||
        data.lawyerExpense !== undefined ||
        data.referralExpense !== undefined ||
        data.otherExpense !== undefined ||
        data.agentId !== undefined ||
        data.ropId !== undefined ||
        data.depositDate !== undefined ||
        agentRateInput !== undefined ||
        ropRateInput !== undefined)

    if (shouldRecalc) {
      const depositDate = data.depositDate ? new Date(data.depositDate) : existing.depositDate
      const agentId = (data.agentId as string | undefined) ?? existing.agentId
      const ropId = (data.ropId as string | undefined) ?? existing.ropId

      const { agentRate, ropRate } = await resolveAppliedRates({
        agentId,
        ropId,
        depositDate,
        agentRateInput,
        ropRateInput,
        existingAgentRate: existing.agentRateApplied,
        existingRopRate: existing.ropRateApplied
      })

      const grossCommission = Number(data.commission ?? existing.commission)
      const taxRate = Number(data.taxRate ?? existing.taxRate)

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

      update = {
        ...update,
        ropRateApplied: ropRate,
        agentRateApplied: agentRate,
        ropCommission: waterfall.ropCommission,
        agentCommission: waterfall.agentCommission,
        netProfit: waterfall.netProfit
      }
    } else if (commissionsManual) {
      if (data.ropCommission !== undefined) update.ropCommission = data.ropCommission
      if (data.agentCommission !== undefined) update.agentCommission = data.agentCommission
      if (data.netProfit !== undefined) update.netProfit = data.netProfit
    }

    if (!shouldRecalc && (agentRateInput !== undefined || ropRateInput !== undefined)) {
      const depositDate = data.depositDate ? new Date(data.depositDate) : existing.depositDate
      const agentId = (data.agentId as string | undefined) ?? existing.agentId
      const ropId = (data.ropId as string | undefined) ?? existing.ropId

      const { agentRate, ropRate } = await resolveAppliedRates({
        agentId,
        ropId,
        depositDate,
        agentRateInput,
        ropRateInput,
        existingAgentRate: existing.agentRateApplied,
        existingRopRate: existing.ropRateApplied
      })

      update.agentRateApplied = agentRate
      update.ropRateApplied = ropRate
    }

    if (legalServicesInput !== undefined || legalServicesAmountInput !== undefined) {
      const legalServicesFinal = legalServicesInput ?? existing.legalServices
      let legalServicesAmountFinal = existing.legalServicesAmount ?? 0
      if (legalServicesAmountInput !== undefined) {
        legalServicesAmountFinal = legalServicesAmountInput ?? 0
      }
      if (!legalServicesFinal) legalServicesAmountFinal = 0
      update.legalServicesAmount = legalServicesAmountFinal
    }

    const deal = await db.deal.update({
      where: { id },
      data: update,
      include: { agent: true, rop: true }
    })

    await ensureDealPayrollAccruals(deal.id)
    return NextResponse.json({ ...deal, ...normalizeDealExpenses(deal as any) })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error updating deal:', error)
    return NextResponse.json(
      { error: 'Failed to update deal' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession()
    if (session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const existing = await db.deal.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

    await db.deal.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error deleting deal:', error)
    return NextResponse.json(
      { error: 'Failed to delete deal' },
      { status: 500 }
    )
  }
}
