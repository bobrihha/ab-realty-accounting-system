import { db } from '@/lib/db'

export async function ensureDealPayrollAccruals(dealId: string) {
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      status: true,
      dealDate: true,
      agentId: true,
      ropId: true,
      agentCommission: true,
      ropCommission: true
    }
  })
  if (!deal) return
  if (deal.status !== 'CLOSED') return

  const accruedAt = deal.dealDate ?? new Date()

  if (deal.agentCommission != null && Number(deal.agentCommission) > 0) {
    await db.payrollAccrual.upsert({
      where: { dealId_employeeId_type: { dealId: deal.id, employeeId: deal.agentId, type: 'AGENT' } },
      update: { amount: Number(deal.agentCommission), accruedAt },
      create: { dealId: deal.id, employeeId: deal.agentId, type: 'AGENT', amount: Number(deal.agentCommission), accruedAt }
    })
  }

  if (deal.ropId && deal.ropCommission != null && Number(deal.ropCommission) > 0) {
    await db.payrollAccrual.upsert({
      where: { dealId_employeeId_type: { dealId: deal.id, employeeId: deal.ropId, type: 'ROP' } },
      update: { amount: Number(deal.ropCommission), accruedAt },
      create: { dealId: deal.id, employeeId: deal.ropId, type: 'ROP', amount: Number(deal.ropCommission), accruedAt }
    })
  }
}

