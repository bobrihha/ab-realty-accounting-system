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

  // Если нет даты сделки или статус CANCELLED — удаляем все начисления по этой сделке
  if (!deal.dealDate || deal.status === 'CANCELLED') {
    await db.payrollAccrual.deleteMany({ where: { dealId: deal.id } })
    return
  }

  const accruedAt = deal.dealDate

  // Удаляем начисления для старых агентов, которые больше не связаны со сделкой
  await db.payrollAccrual.deleteMany({
    where: {
      dealId: deal.id,
      type: 'AGENT',
      NOT: { employeeId: deal.agentId }
    }
  })

  // Удаляем начисления для старых РОПов или если РОП убран со сделки
  if (deal.ropId) {
    await db.payrollAccrual.deleteMany({
      where: {
        dealId: deal.id,
        type: 'ROP',
        NOT: { employeeId: deal.ropId }
      }
    })
  } else {
    await db.payrollAccrual.deleteMany({
      where: { dealId: deal.id, type: 'ROP' }
    })
  }

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

