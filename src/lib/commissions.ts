import { db } from '@/lib/db'

type RateType = 'AGENT' | 'ROP'

export async function getRateForEmployeeAtDate(
  employeeId: string,
  type: RateType,
  at: Date
): Promise<number | null> {
  const latest = await db.commissionRate.findFirst({
    where: { employeeId, type, effectiveDate: { lte: at } },
    orderBy: { effectiveDate: 'desc' }
  })
  return latest?.rate ?? null
}

export function computeWaterfall(params: {
  grossCommission: number
  taxRatePercent: number
  referralExpense: number
  brokerExpense: number
  lawyerExpense: number
  otherExpense: number
  agentRatePercent: number
  ropRatePercent: number
}) {
  const taxes = params.grossCommission * (params.taxRatePercent / 100)
  const commissionBase = params.grossCommission - params.referralExpense
  const ropCommission = commissionBase * (params.ropRatePercent / 100)
  const agentCommission = commissionBase * (params.agentRatePercent / 100)
  const nonReferralExpenses = params.brokerExpense + params.lawyerExpense + params.otherExpense
  const netProfit =
    params.grossCommission -
    taxes -
    params.referralExpense -
    ropCommission -
    agentCommission -
    nonReferralExpenses

  return {
    taxes,
    cleanedBase: commissionBase,
    ropCommission,
    agentCommission,
    netProfit
  }
}
