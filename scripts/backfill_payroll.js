/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()

async function main() {
  const closedDeals = await db.deal.findMany({
    where: { status: 'CLOSED' },
    select: { id: true, dealDate: true, agentId: true, ropId: true, agentCommission: true, ropCommission: true }
  })

  let upserts = 0

  for (const d of closedDeals) {
    const accruedAt = d.dealDate ?? new Date()

    if (d.agentCommission != null && d.agentCommission > 0) {
      await db.payrollAccrual.upsert({
        where: { dealId_employeeId_type: { dealId: d.id, employeeId: d.agentId, type: 'AGENT' } },
        update: { amount: d.agentCommission, accruedAt },
        create: { dealId: d.id, employeeId: d.agentId, type: 'AGENT', amount: d.agentCommission, accruedAt }
      })
      upserts++
    }

    if (d.ropId && d.ropCommission != null && d.ropCommission > 0) {
      await db.payrollAccrual.upsert({
        where: { dealId_employeeId_type: { dealId: d.id, employeeId: d.ropId, type: 'ROP' } },
        update: { amount: d.ropCommission, accruedAt },
        create: { dealId: d.id, employeeId: d.ropId, type: 'ROP', amount: d.ropCommission, accruedAt }
      })
      upserts++
    }
  }

  console.log(`Backfill done. deals=${closedDeals.length} accrualUpserts=${upserts}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })

