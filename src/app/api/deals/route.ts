import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession, canViewAllDeals } from '@/lib/guards'
import { computeWaterfall, getRateForEmployeeAtDate } from '@/lib/commissions'

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

    return NextResponse.json(deals)
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

    const agentRate =
      (await getRateForEmployeeAtDate(agentId, 'AGENT', depositDate)) ??
      agent.baseRateAgent ??
      0

    let ropRate = 0
    if (ropId) {
      const rop = await db.employee.findUnique({ where: { id: ropId } })
      if (rop) {
        ropRate =
          (await getRateForEmployeeAtDate(ropId, 'ROP', depositDate)) ??
          rop.baseRateROP ??
          0
      }
    }

    const grossCommission = Number(data.commission ?? 0)
    const taxRate = Number(data.taxRate ?? 6)
    const externalExpenses = Number(data.externalExpenses ?? 0)
    const commissionsManual = Boolean(data.commissionsManual)

    const waterfall = computeWaterfall({
      grossCommission,
      taxRatePercent: taxRate,
      externalExpenses,
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
        legalServices: Boolean(data.legalServices),
        notes: data.notes ? String(data.notes) : null,
        taxRate,
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

    return NextResponse.json(deal, { status: 201 })
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
