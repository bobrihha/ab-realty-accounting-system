import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'
import { formatMonthLabel, monthKey } from '@/lib/money'

function canViewFinance(role: string) {
  return role === 'OWNER' || role === 'ACCOUNTANT'
}

function cleanedBase(d: { commission: number; referralExpense: number }) {
  return d.commission - d.referralExpense
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!canViewFinance(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const year = Number(searchParams.get('year') ?? new Date().getFullYear())
    const from = new Date(year, 0, 1)
    const to = new Date(year, 11, 31, 23, 59, 59, 999)

    const dealsByBooking = await db.deal.findMany({
      where: { depositDate: { gte: from, lte: to }, NOT: { status: 'CANCELLED' } },
      select: {
        id: true,
        agentId: true,
        ropId: true,
        depositDate: true,
        commission: true
      }
    })

    const dealsClosed = await db.deal.findMany({
      where: { dealDate: { gte: from, lte: to }, NOT: { status: 'CANCELLED' } },
      select: {
        id: true,
        agentId: true,
        ropId: true,
        dealDate: true,
        commission: true,
        price: true,
        netProfit: true,
        agentCommission: true,
        ropCommission: true,
        referralExpense: true,
        agentRateApplied: true,
        ropRateApplied: true
      }
    })

    // Юр.услуги из сделок (только по dealDate, как в /api/legal-services/stats)
    const legalServicesDeals = await db.deal.findMany({
      where: {
        legalServices: true,
        dealDate: { gte: from, lte: to }
      },
      select: {
        dealDate: true,
        legalServicesAmount: true
      }
    })

    const employees = await db.employee.findMany({
      where: { role: { in: ['AGENT', 'ROP'] } },
      select: { id: true, name: true, role: true }
    })
    const employeeById = new Map(employees.map(e => [e.id, e] as const))

    const mkFor = (d: Date) => monthKey(d)

    const months = Array.from({ length: 12 }, (_, m) => {
      const mk = monthKey(new Date(year, m, 1))
      return {
        monthKey: mk,
        month: formatMonthLabel(mk),
        bookingRevenue: 0,
        dealRevenue: 0,
        soldPrice: 0,
        netProfit: 0,
        agentCommission: 0,
        ropCommission: 0,
        _dealCount: 0,
        _agentRateSum: 0,
        _ropRateSum: 0
      }
    })
    const monthIndex = new Map(months.map((m, i) => [m.monthKey, i] as const))

    const ensureMonth = (mk: string) => {
      const idx = monthIndex.get(mk)
      if (idx == null) return null
      return months[idx]
    }

    const legalMonths = months.map(m => ({
      monthKey: m.monthKey,
      month: m.month,
      dealsCount: 0,
      amount: 0
    }))
    const legalMonthIndex = new Map(legalMonths.map((m, i) => [m.monthKey, i] as const))
    const ensureLegalMonth = (mk: string) => {
      const idx = legalMonthIndex.get(mk)
      if (idx == null) return null
      return legalMonths[idx]
    }

    type PersonMonth = {
      monthKey: string
      month: string
      bookingRevenue: number
      dealRevenue: number
      soldPrice: number
      netProfit: number
      commission: number
      ratePct: number
      margin: number
    }

    const initPersonMonths = () =>
      months.map(m => ({
        monthKey: m.monthKey,
        month: m.month,
        bookingRevenue: 0,
        dealRevenue: 0,
        soldPrice: 0,
        netProfit: 0,
        commission: 0,
        _baseSum: 0,
        _rateWeighted: 0
      }))

    const finalizePersonMonths = (arr: any[]): PersonMonth[] =>
      arr.map(m => {
        const ratePct = m._baseSum > 0 ? m._rateWeighted / m._baseSum : 0
        const margin = m.dealRevenue > 0 ? (m.netProfit / m.dealRevenue) * 100 : 0
        return {
          monthKey: m.monthKey,
          month: m.month,
          bookingRevenue: m.bookingRevenue,
          dealRevenue: m.dealRevenue,
          soldPrice: m.soldPrice,
          netProfit: m.netProfit,
          commission: m.commission,
          ratePct,
          margin
        }
      })

    const agentMonthly = new Map<string, { employeeId: string; name: string; months: any[] }>()
    const ropMonthly = new Map<string, { employeeId: string; name: string; months: any[] }>()

    const ensureMonthly = (map: Map<string, any>, id: string) => {
      const existing = map.get(id)
      if (existing) return existing
      const e = employeeById.get(id)
      const row = { employeeId: id, name: e?.name ?? id, months: initPersonMonths() }
      map.set(id, row)
      return row
    }

    const ensurePersonMonth = (row: any, mk: string) => {
      const idx = monthIndex.get(mk)
      if (idx == null) return null
      return row.months[idx]
    }

    for (const d of dealsByBooking) {
      const mk = mkFor(d.depositDate)
      const m = ensureMonth(mk)
      if (!m) continue
      m.bookingRevenue += d.commission
    }

    for (const d of legalServicesDeals) {
      if (!d.dealDate) continue
      const mk = mkFor(d.dealDate)
      const m = ensureLegalMonth(mk)
      if (!m) continue
      m.dealsCount += 1
      m.amount += Number(d.legalServicesAmount ?? 0)
    }

    for (const d of dealsClosed) {
      if (!d.dealDate) continue
      const mk = mkFor(d.dealDate)
      const m = ensureMonth(mk)
      if (!m) continue

      m.dealRevenue += d.commission
      m.soldPrice += d.price
      m.netProfit += d.netProfit ?? 0
      m.agentCommission += d.agentCommission ?? 0
      m.ropCommission += d.ropCommission ?? 0
      // Для расчёта среднего % ставки
      m._dealCount += 1
      m._agentRateSum += d.agentRateApplied ?? 0
      m._ropRateSum += d.ropRateApplied ?? 0
    }

    const byAgent = new Map<
      string,
      {
        employeeId: string
        name: string
        role: 'AGENT'
        bookingRevenue: number
        dealRevenue: number
        soldPrice: number
        netProfit: number
        commission: number
        _baseSum: number
        _rateWeighted: number
      }
    >()

    const byRop = new Map<
      string,
      {
        employeeId: string
        name: string
        role: 'ROP'
        bookingRevenue: number
        dealRevenue: number
        soldPrice: number
        netProfit: number
        commission: number
        _baseSum: number
        _rateWeighted: number
      }
    >()

    const ensureEmp = (map: any, id: string, role: 'AGENT' | 'ROP') => {
      const existing = map.get(id)
      if (existing) return existing
      const e = employeeById.get(id)
      const row = {
        employeeId: id,
        name: e?.name ?? id,
        role,
        bookingRevenue: 0,
        dealRevenue: 0,
        soldPrice: 0,
        netProfit: 0,
        commission: 0,
        _baseSum: 0,
        _rateWeighted: 0
      }
      map.set(id, row)
      return row
    }

    for (const d of dealsByBooking) {
      const a = ensureEmp(byAgent, d.agentId, 'AGENT')
      a.bookingRevenue += d.commission
      if (d.ropId) {
        const r = ensureEmp(byRop, d.ropId, 'ROP')
        r.bookingRevenue += d.commission
      }

      const am = ensureMonthly(agentMonthly, d.agentId)
      const amRow = ensurePersonMonth(am, mkFor(d.depositDate))
      if (amRow) amRow.bookingRevenue += d.commission

      if (d.ropId) {
        const rm = ensureMonthly(ropMonthly, d.ropId)
        const rmRow = ensurePersonMonth(rm, mkFor(d.depositDate))
        if (rmRow) rmRow.bookingRevenue += d.commission
      }
    }

    for (const d of dealsClosed) {
      const a = ensureEmp(byAgent, d.agentId, 'AGENT')
      a.dealRevenue += d.commission
      a.soldPrice += d.price
      a.netProfit += d.netProfit ?? 0
      a.commission += d.agentCommission ?? 0

      const base = cleanedBase({ commission: d.commission, referralExpense: d.referralExpense })
      if (base > 0) {
        a._baseSum += base
        a._rateWeighted += base * (d.agentRateApplied ?? 0)
      }

      if (d.dealDate) {
        const am = ensureMonthly(agentMonthly, d.agentId)
        const amRow = ensurePersonMonth(am, mkFor(d.dealDate))
        if (amRow) {
          amRow.dealRevenue += d.commission
          amRow.soldPrice += d.price
          amRow.netProfit += d.netProfit ?? 0
          amRow.commission += d.agentCommission ?? 0
          if (base > 0) {
            amRow._baseSum += base
            amRow._rateWeighted += base * (d.agentRateApplied ?? 0)
          }
        }
      }

      if (d.ropId) {
        const r = ensureEmp(byRop, d.ropId, 'ROP')
        r.dealRevenue += d.commission
        r.soldPrice += d.price
        r.netProfit += d.netProfit ?? 0
        r.commission += d.ropCommission ?? 0
        if (base > 0) {
          r._baseSum += base
          r._rateWeighted += base * (d.ropRateApplied ?? 0)
        }

        if (d.dealDate) {
          const rm = ensureMonthly(ropMonthly, d.ropId)
          const rmRow = ensurePersonMonth(rm, mkFor(d.dealDate))
          if (rmRow) {
            rmRow.dealRevenue += d.commission
            rmRow.soldPrice += d.price
            rmRow.netProfit += d.netProfit ?? 0
            rmRow.commission += d.ropCommission ?? 0
            if (base > 0) {
              rmRow._baseSum += base
              rmRow._rateWeighted += base * (d.ropRateApplied ?? 0)
            }
          }
        }
      }
    }

    const monthRows = months.map(m => {
      // Средний % ставки = сумма ставок / количество сделок
      const agentPct = m._dealCount > 0 ? m._agentRateSum / m._dealCount : 0
      const ropPct = m._dealCount > 0 ? m._ropRateSum / m._dealCount : 0
      const sumPct = agentPct + ropPct
      const margin = m.dealRevenue > 0 ? (m.netProfit / m.dealRevenue) * 100 : 0
      return {
        monthKey: m.monthKey,
        month: m.month,
        bookingRevenue: m.bookingRevenue,
        dealRevenue: m.dealRevenue,
        soldPrice: m.soldPrice,
        netProfit: m.netProfit,
        agentCommission: m.agentCommission,
        ropCommission: m.ropCommission,
        agentPct,
        ropPct,
        sumPct,
        margin
      }
    })

    const totals = monthRows.reduce(
      (acc, m) => {
        acc.bookingRevenue += m.bookingRevenue
        acc.dealRevenue += m.dealRevenue
        acc.soldPrice += m.soldPrice
        acc.netProfit += m.netProfit
        acc.agentCommission += m.agentCommission
        acc.ropCommission += m.ropCommission
        return acc
      },
      { bookingRevenue: 0, dealRevenue: 0, soldPrice: 0, netProfit: 0, agentCommission: 0, ropCommission: 0 }
    )
    const totalMargin = totals.dealRevenue > 0 ? (totals.netProfit / totals.dealRevenue) * 100 : 0

    const agentRows = Array.from(byAgent.values())
      .map(r => ({
        ...r,
        ratePct: r._baseSum > 0 ? r._rateWeighted / r._baseSum : 0
      }))
      .sort((a, b) => b.dealRevenue - a.dealRevenue)

    const ropRows = Array.from(byRop.values())
      .map(r => ({
        ...r,
        ratePct: r._baseSum > 0 ? r._rateWeighted / r._baseSum : 0
      }))
      .sort((a, b) => b.dealRevenue - a.dealRevenue)

    const agentMonthlyRows = Array.from(agentMonthly.values())
      .map(r => ({ employeeId: r.employeeId, name: r.name, months: finalizePersonMonths(r.months) }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const ropMonthlyRows = Array.from(ropMonthly.values())
      .map(r => ({ employeeId: r.employeeId, name: r.name, months: finalizePersonMonths(r.months) }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const legalTotals = legalMonths.reduce(
      (acc, m) => {
        acc.dealsCount += m.dealsCount
        acc.amount += m.amount
        return acc
      },
      { dealsCount: 0, amount: 0 }
    )

    return NextResponse.json({
      year,
      months: monthRows,
      totals: { ...totals, margin: totalMargin },
      byAgent: agentRows,
      byRop: ropRows,
      byAgentMonthly: agentMonthlyRows,
      byRopMonthly: ropMonthlyRows,
      legalServices: {
        months: legalMonths,
        totals: legalTotals
      }
    })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching finance metrics:', error)
    return NextResponse.json({ error: 'Failed to fetch finance metrics' }, { status: 500 })
  }
}
