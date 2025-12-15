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
  externalExpenses: number
  agentRatePercent: number
  ropRatePercent: number
}) {
  const taxes = params.grossCommission * (params.taxRatePercent / 100)
  const cleanedBase = params.grossCommission - taxes - params.externalExpenses
  const ropCommission = cleanedBase * (params.ropRatePercent / 100)
  const agentCommission = cleanedBase * (params.agentRatePercent / 100)
  const netProfit = cleanedBase - ropCommission - agentCommission

  return {
    taxes,
    cleanedBase,
    ropCommission,
    agentCommission,
    netProfit
  }
}

