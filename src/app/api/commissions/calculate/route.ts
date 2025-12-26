import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guards'
import { db } from '@/lib/db'
import { computeWaterfall, getRateForEmployeeAtDate } from '@/lib/commissions'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const ropId = searchParams.get('ropId')
    const grossCommission = parseFloat(searchParams.get('grossCommission') || '0')
    const taxRate = parseFloat(searchParams.get('taxRate') || '6')
    const referralExpense = parseFloat(searchParams.get('referralExpense') || '0')
    const brokerExpense = parseFloat(searchParams.get('brokerExpense') || '0')
    const lawyerExpense = parseFloat(searchParams.get('lawyerExpense') || '0')
    let otherExpense = parseFloat(searchParams.get('otherExpense') || '0')
    const externalExpenses = parseFloat(searchParams.get('externalExpenses') || '0')
    const at = searchParams.get('at') ? new Date(searchParams.get('at') as string) : new Date()

    await requireSession()

    const agent = agentId ? await db.employee.findUnique({ where: { id: agentId } }) : null
    const rop = ropId ? await db.employee.findUnique({ where: { id: ropId } }) : null

    const agentRate =
      (agentId ? await getRateForEmployeeAtDate(agentId, 'AGENT', at) : null) ??
      agent?.baseRateAgent ??
      0

    const ropRate =
      (ropId ? await getRateForEmployeeAtDate(ropId, 'ROP', at) : null) ??
      rop?.baseRateROP ??
      0

    const breakdownSum = referralExpense + brokerExpense + lawyerExpense + otherExpense
    if (breakdownSum === 0 && externalExpenses !== 0) {
      otherExpense = externalExpenses
    }

    const { taxes, cleanedBase, ropCommission, agentCommission, netProfit } = computeWaterfall({
      grossCommission,
      taxRatePercent: taxRate,
      referralExpense,
      brokerExpense,
      lawyerExpense,
      otherExpense,
      agentRatePercent: agentRate,
      ropRatePercent: ropRate
    })
    const totalExternal = referralExpense + brokerExpense + lawyerExpense + otherExpense
    const baseLabel = 'База для % (выручка − рекомендация)'
    const otherExpenses = brokerExpense + otherExpense

    const calculation = {
      grossCommission,
      taxes,
      externalExpenses: totalExternal,
      referralExpense,
      brokerExpense,
      lawyerExpense,
      otherExpense,
      cleanedBase,
      ropCommission,
      agentCommission,
      netProfit,
      agentRate,
      ropRate,
      taxRate,
      calculationSteps: [
        `Валовая комиссия: ${grossCommission.toLocaleString('ru-RU')} ₽`,
        `Налоги (${taxRate}%): ${taxes.toLocaleString('ru-RU')} ₽`,
        `Рекомендация: ${referralExpense.toLocaleString('ru-RU')} ₽`,
        `${baseLabel}: ${cleanedBase.toLocaleString('ru-RU')} ₽`,
        `Комиссия РОПа (${ropRate}%): ${ropCommission.toLocaleString('ru-RU')} ₽`,
        `Комиссия агента (${agentRate}%): ${agentCommission.toLocaleString('ru-RU')} ₽`,
        `Юрист: ${lawyerExpense.toLocaleString('ru-RU')} ₽`,
        `Расходы (брокер/ипотека + прочее): ${otherExpenses.toLocaleString('ru-RU')} ₽`,
        `Чистая прибыль: ${netProfit.toLocaleString('ru-RU')} ₽`
      ]
    }

    return NextResponse.json(calculation)
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error calculating commissions:', error)
    return NextResponse.json(
      { error: 'Failed to calculate commissions' },
      { status: 500 }
    )
  }
}
