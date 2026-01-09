import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'

function canAccessPayroll(role: string) {
  return role === 'OWNER' || role === 'ACCOUNTANT' || role === 'ROP' || role === 'AGENT'
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!canAccessPayroll(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!(db as any).payrollAccrual?.findMany) {
      return NextResponse.json(
        { error: 'Требуется перезапуск сервера после обновления базы/Prisma (payrollAccrual отсутствует в Prisma Client).' },
        { status: 503 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? 'all' // all | unpaid | partially | paid
    let employeeId = searchParams.get('employeeId') ?? 'all'
    const type = searchParams.get('type') ?? 'all' // all | AGENT | ROP

    // Для агентов — принудительно фильтруем только их данные
    if (session.role === 'AGENT') {
      employeeId = session.userId
    }

    const accruals = await (db as any).payrollAccrual.findMany({
      where: {
        ...(employeeId !== 'all' ? { employeeId } : {}),
        ...(type !== 'all' ? { type: String(type).toUpperCase() as any } : {})
      },
      orderBy: { accruedAt: 'desc' },
      include: {
        employee: { select: { id: true, name: true, role: true } },
        deal: { select: { id: true, client: true, object: true, depositDate: true, dealDate: true, status: true } },
        payments: {
          orderBy: { paidAt: 'desc' },
          include: { account: { select: { id: true, name: true } } }
        }
      }
    })

    const enriched = accruals
      .map(a => {
        const paid = a.payments.reduce((s, p) => s + p.amount, 0)
        const remaining = Math.max(0, a.amount - paid)
        const derivedStatus = remaining <= 0 ? 'paid' : paid > 0 ? 'partially' : 'unpaid'
        return { ...a, paid, remaining, derivedStatus }
      })
      .filter(a => (status === 'all' ? true : a.derivedStatus === status))

    // Для агентов не отдаём список всех сотрудников
    const employees = session.role === 'AGENT' ? [] : await db.employee.findMany({
      where: { role: { in: ['AGENT', 'ROP'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, role: true, status: true }
    })

    return NextResponse.json({ accruals: enriched, employees })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching payroll:', error)
    return NextResponse.json({ error: 'Failed to fetch payroll' }, { status: 500 })
  }
}
