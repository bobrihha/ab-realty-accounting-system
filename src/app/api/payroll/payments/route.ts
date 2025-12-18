import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'

function canEditPayroll(role: string) {
  return role === 'OWNER' || role === 'ACCOUNTANT'
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!canEditPayroll(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!(db as any).payrollAccrual?.findUnique || !(db as any).payrollPayment?.create) {
      return NextResponse.json(
        { error: 'Требуется перезапуск сервера после обновления базы/Prisma (payroll модели отсутствуют в Prisma Client).' },
        { status: 503 }
      )
    }

    const data = await request.json()
    const accrualId = String(data.accrualId ?? '')
    const accountId = String(data.accountId ?? '')
    const amount = Number(data.amount ?? 0)
    const paidAt = data.paidAt ? new Date(data.paidAt) : new Date()
    const description = data.description ? String(data.description) : null

    if (!accrualId || !accountId) {
      return NextResponse.json({ error: 'accrualId and accountId are required' }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })
    }

    const accrual = await (db as any).payrollAccrual.findUnique({
      where: { id: accrualId },
      include: { payments: true, employee: true, deal: true }
    })
    if (!accrual) return NextResponse.json({ error: 'Accrual not found' }, { status: 404 })

    const alreadyPaid = accrual.payments.reduce((s, p) => s + p.amount, 0)
    const remaining = accrual.amount - alreadyPaid
    if (remaining <= 0) return NextResponse.json({ error: 'Accrual already fully paid' }, { status: 409 })
    if (amount > remaining + 0.00001) {
      return NextResponse.json({ error: `amount exceeds remaining (${remaining})` }, { status: 400 })
    }

    const category = accrual.type === 'AGENT' ? 'ЗП агентам (выплата)' : 'ЗП РОП (выплата)'
    const cfDescription =
      description ??
      `Выплата ${accrual.type === 'AGENT' ? 'агенту' : 'РОПу'}: ${accrual.employee.name} · Сделка: ${accrual.deal.client}`

      const created = await db.$transaction(async tx => {
      const cashFlow = await tx.cashFlow.create({
        data: {
          type: 'EXPENSE',
          amount,
          category,
          status: 'PAID',
          plannedDate: paidAt,
          actualDate: paidAt,
          description: cfDescription,
          accountId
        }
      })

      await tx.account.update({
        where: { id: accountId },
        data: { balance: { increment: -amount } }
      })

      const payment = await (tx as any).payrollPayment.create({
        data: {
          accrualId,
          amount,
          paidAt,
          accountId,
          cashFlowId: cashFlow.id,
          description
        }
      })

      return payment
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating payroll payment:', error)
    return NextResponse.json({ error: 'Failed to create payroll payment' }, { status: 500 })
  }
}
