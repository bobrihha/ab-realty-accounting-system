/**
 * Скрипт для поиска "осиротевших" начислений
 * 
 * Осиротевшее начисление — это начисление, где:
 * - Для типа AGENT: employeeId начисления != agentId сделки
 * - Для типа ROP: employeeId начисления != ropId сделки
 * 
 * Такие начисления возникают когда агент/РОП в сделке был изменён,
 * но старое начисление не было удалено.
 * 
 * Запуск: source scripts/env.sh && npx tsx scripts/find_orphan_accruals.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface OrphanAccrual {
    accrualId: string
    type: string
    amount: number
    paidAmount: number
    employeeName: string
    employeeId: string
    currentDealEmployeeId: string | null
    currentDealEmployeeName: string | null
    dealId: string
    dealClient: string
    dealDate: Date | null
}

async function findOrphanAccruals(): Promise<OrphanAccrual[]> {
    const accruals = await prisma.payrollAccrual.findMany({
        include: {
            employee: { select: { id: true, name: true } },
            deal: {
                select: {
                    id: true,
                    client: true,
                    object: true,
                    dealDate: true,
                    agentId: true,
                    ropId: true,
                    agent: { select: { id: true, name: true } },
                    rop: { select: { id: true, name: true } }
                }
            },
            payments: { select: { amount: true } }
        }
    })

    const orphans: OrphanAccrual[] = []

    for (const a of accruals) {
        const isAgent = a.type === 'AGENT'
        const currentEmployeeId = isAgent ? a.deal.agentId : a.deal.ropId
        const currentEmployee = isAgent ? a.deal.agent : a.deal.rop

        // Начисление осиротевшее, если employeeId не совпадает с текущим агентом/РОПом сделки
        if (a.employeeId !== currentEmployeeId) {
            const paidAmount = a.payments.reduce((sum, p) => sum + p.amount, 0)

            orphans.push({
                accrualId: a.id,
                type: a.type,
                amount: a.amount,
                paidAmount,
                employeeName: a.employee.name,
                employeeId: a.employeeId,
                currentDealEmployeeId: currentEmployeeId,
                currentDealEmployeeName: currentEmployee?.name || null,
                dealId: a.deal.id,
                dealClient: a.deal.client,
                dealDate: a.deal.dealDate
            })
        }
    }

    return orphans
}

async function main() {
    console.log('🔍 Поиск осиротевших начислений...\n')

    const orphans = await findOrphanAccruals()

    if (orphans.length === 0) {
        console.log('✅ Осиротевших начислений не найдено!')
        return
    }

    console.log(`⚠️  Найдено ${orphans.length} осиротевших начислений:\n`)
    console.log('='.repeat(80))

    // Группируем по сотруднику для удобства
    const byEmployee: Record<string, typeof orphans> = {}
    for (const o of orphans) {
        if (!byEmployee[o.employeeName]) byEmployee[o.employeeName] = []
        byEmployee[o.employeeName].push(o)
    }

    let totalOrphanAmount = 0
    let totalOrphanPaid = 0

    for (const [employeeName, records] of Object.entries(byEmployee)) {
        const empAccrued = records.reduce((s, r) => s + r.amount, 0)
        const empPaid = records.reduce((s, r) => s + r.paidAmount, 0)
        totalOrphanAmount += empAccrued
        totalOrphanPaid += empPaid

        console.log(`\n👤 ${employeeName}`)
        console.log(`   Осиротевших начислений: ${records.length}`)
        console.log(`   Сумма начислено: ${empAccrued.toLocaleString('ru-RU')} ₽`)
        console.log(`   Сумма выплачено: ${empPaid.toLocaleString('ru-RU')} ₽`)

        for (const r of records) {
            console.log(`\n   📋 Сделка: ${r.dealClient}`)
            console.log(`      DealId: ${r.dealId}`)
            console.log(`      Тип: ${r.type}`)
            console.log(`      Начислено: ${r.amount.toLocaleString('ru-RU')} ₽`)
            console.log(`      Выплачено: ${r.paidAmount.toLocaleString('ru-RU')} ₽`)
            console.log(`      Дата сделки: ${r.dealDate ? r.dealDate.toLocaleDateString('ru-RU') : '—'}`)
            console.log(`      ⚡ Сейчас в сделке: ${r.currentDealEmployeeName || 'никто'} (${r.currentDealEmployeeId || 'null'})`)
        }
    }

    console.log('\n' + '='.repeat(80))
    console.log(`\n📊 ИТОГО ОСИРОТЕВШИХ:`)
    console.log(`   Начислено: ${totalOrphanAmount.toLocaleString('ru-RU')} ₽`)
    console.log(`   Выплачено: ${totalOrphanPaid.toLocaleString('ru-RU')} ₽`)
    console.log(`\n💡 Эти ${totalOrphanPaid.toLocaleString('ru-RU')} ₽ выплат показываются сотрудникам, хотя сделки уже принадлежат другим.\n`)

    // Дополнительно выводим команду для исправления
    console.log('🔧 Для удаления осиротевших начислений (и связанных выплат) выполните:')
    console.log('   source scripts/env.sh && npx tsx scripts/cleanup_orphan_accruals.ts\n')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
