/**
 * Скрипт для удаления осиротевших начислений
 * 
 * ⚠️ ВНИМАНИЕ: Этот скрипт УДАЛЯЕТ данные!
 * При удалении PayrollAccrual также удаляются связанные PayrollPayment (каскадно).
 * 
 * Сначала запустите find_orphan_accruals.ts чтобы увидеть что будет удалено.
 * 
 * Запуск: source scripts/env.sh && npx tsx scripts/cleanup_orphan_accruals.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function findOrphanAccrualIds(): Promise<string[]> {
    const accruals = await prisma.payrollAccrual.findMany({
        include: {
            deal: { select: { agentId: true, ropId: true } }
        }
    })

    const orphanIds: string[] = []

    for (const a of accruals) {
        const currentEmployeeId = a.type === 'AGENT' ? a.deal.agentId : a.deal.ropId
        if (a.employeeId !== currentEmployeeId) {
            orphanIds.push(a.id)
        }
    }

    return orphanIds
}

async function main() {
    const args = process.argv.slice(2)
    const dryRun = !args.includes('--confirm')

    console.log('🧹 Очистка осиротевших начислений\n')

    if (dryRun) {
        console.log('⚠️  РЕЖИМ ПРЕДПРОСМОТРА (dry-run)')
        console.log('   Для реального удаления добавьте флаг --confirm\n')
    }

    const orphanIds = await findOrphanAccrualIds()

    if (orphanIds.length === 0) {
        console.log('✅ Осиротевших начислений не найдено!')
        return
    }

    // Получаем детали для отчёта
    const orphans = await prisma.payrollAccrual.findMany({
        where: { id: { in: orphanIds } },
        include: {
            employee: { select: { name: true } },
            deal: { select: { client: true } },
            payments: { select: { amount: true } }
        }
    })

    let totalAmount = 0
    let totalPaid = 0
    let totalPayments = 0

    for (const o of orphans) {
        const paid = o.payments.reduce((s, p) => s + p.amount, 0)
        totalAmount += o.amount
        totalPaid += paid
        totalPayments += o.payments.length
        console.log(`  - ${o.employee.name}: ${o.amount.toLocaleString('ru-RU')} ₽ (выплачено ${paid.toLocaleString('ru-RU')} ₽) — "${o.deal.client}"`)
    }

    console.log(`\n📊 Итого к удалению:`)
    console.log(`   Начислений: ${orphanIds.length}`)
    console.log(`   Сумма начислений: ${totalAmount.toLocaleString('ru-RU')} ₽`)
    console.log(`   Выплат: ${totalPayments}`)
    console.log(`   Сумма выплат: ${totalPaid.toLocaleString('ru-RU')} ₽`)

    if (dryRun) {
        console.log('\n💡 Для подтверждения удаления выполните:')
        console.log('   source scripts/env.sh && npx tsx scripts/cleanup_orphan_accruals.ts --confirm\n')
        return
    }

    console.log('\n🗑️  Удаление...')

    const result = await prisma.payrollAccrual.deleteMany({
        where: { id: { in: orphanIds } }
    })

    console.log(`\n✅ Удалено ${result.count} осиротевших начислений (и связанные выплаты).\n`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
