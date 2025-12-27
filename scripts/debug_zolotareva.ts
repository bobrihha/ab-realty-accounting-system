import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // Найти сотрудника Золотарева
    const employees = await prisma.employee.findMany({
        where: { name: { contains: 'Золотарев', mode: 'insensitive' } }
    })

    console.log('=== EMPLOYEES ===')
    console.log(employees.map(e => ({ id: e.id, name: e.name, role: e.role })))

    if (employees.length === 0) {
        console.log('Сотрудник не найден')
        return
    }

    const employeeId = employees[0].id
    console.log(`\nАнализируем сотрудника: ${employees[0].name} (${employeeId})`)

    // Все начисления этого сотрудника
    const accruals = await prisma.payrollAccrual.findMany({
        where: { employeeId },
        include: {
            deal: { select: { id: true, client: true, object: true, dealDate: true, status: true, agentId: true, ropId: true } },
            payments: true
        },
        orderBy: { accruedAt: 'desc' }
    })

    console.log(`\n=== НАЧИСЛЕНИЯ (${accruals.length} шт) ===`)

    let totalAccrued = 0
    let totalPaid = 0

    for (const a of accruals) {
        const paid = a.payments.reduce((s, p) => s + p.amount, 0)
        totalAccrued += a.amount
        totalPaid += paid

        // Проверяем, есть ли несоответствие агента в сделке
        const dealAgent = a.type === 'AGENT' ? a.deal.agentId : a.deal.ropId
        const mismatch = dealAgent !== a.employeeId ? ' ⚠️ MISMATCH!' : ''

        console.log(`\n[${a.type}] Начислено: ${a.amount} | Выплачено: ${paid} | Остаток: ${a.amount - paid}${mismatch}`)
        console.log(`  Сделка: ${a.deal.client} | ${a.deal.object?.substring(0, 50)}`)
        console.log(`  DealId: ${a.deal.id}`)
        console.log(`  Статус сделки: ${a.deal.status} | Дата: ${a.deal.dealDate}`)
        console.log(`  Deal.agentId: ${a.deal.agentId}`)
        console.log(`  Deal.ropId: ${a.deal.ropId || '—'}`)

        if (a.payments.length > 0) {
            console.log(`  Выплаты:`)
            for (const p of a.payments) {
                console.log(`    - ${p.amount} (${new Date(p.paidAt).toLocaleDateString()})`)
            }
        }
    }

    console.log(`\n=== ИТОГО ===`)
    console.log(`Начислено: ${totalAccrued}`)
    console.log(`Выплачено: ${totalPaid}`)
    console.log(`К выплате: ${totalAccrued - totalPaid}`)

    // Проверяем есть ли "осиротевшие" начисления - где сделка принадлежит другому агенту
    console.log(`\n=== ОСИРОТЕВШИЕ НАЧИСЛЕНИЯ ===`)
    const orphans = accruals.filter(a => {
        const currentDealEmployee = a.type === 'AGENT' ? a.deal.agentId : a.deal.ropId
        return currentDealEmployee !== a.employeeId
    })

    if (orphans.length === 0) {
        console.log('Нет осиротевших начислений')
    } else {
        let orphanPaid = 0
        console.log(`Найдено ${orphans.length} осиротевших начислений:`)
        for (const a of orphans) {
            const paid = a.payments.reduce((s, p) => s + p.amount, 0)
            orphanPaid += paid
            console.log(`  - Сделка "${a.deal.client}": начислено ${a.amount}, выплачено ${paid}`)
            console.log(`    Сейчас в сделке агент: ${a.deal.agentId}, а начисление на: ${a.employeeId}`)
        }
        console.log(`\nИтого в осиротевших выплачено: ${orphanPaid}`)
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
