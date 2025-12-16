import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'
import { hash } from 'bcryptjs'
import { Prisma } from '@prisma/client'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    if (session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()

    const passwordHash = data.password ? await hash(String(data.password), 10) : undefined

    const employee = await db.employee.update({
      where: { id: params.id },
      data: {
        name: data.name ?? undefined,
        email: data.email ? String(data.email).trim().toLowerCase() : undefined,
        phone: data.phone ?? undefined,
        role: data.role ? String(data.role).toUpperCase() : undefined,
        status: data.status ? String(data.status).toUpperCase() : undefined,
        department: data.department === null ? null : data.department ?? undefined,
        hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
        terminationDate: data.terminationDate ? new Date(data.terminationDate) : data.terminationDate === null ? null : undefined,
        baseRateAgent: data.baseRateAgent === null ? null : data.baseRateAgent ?? undefined,
        baseRateROP: data.baseRateROP === null ? null : data.baseRateROP ?? undefined,
        managerId: data.managerId === null ? null : data.managerId ?? undefined,
        passwordHash
      },
      include: { commissionRates: true }
    })

    return NextResponse.json(employee)
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error updating employee:', error)
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    if (session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check for dependencies
    const employee = await db.employee.findUnique({
      where: { id: params.id },
      include: {
        dealsAsAgent: { select: { id: true }, take: 1 },
        dealsAsROP: { select: { id: true }, take: 1 },
        subordinates: { select: { id: true }, take: 1 }
      }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 })
    }

    const hasDeals = employee.dealsAsAgent.length > 0 || employee.dealsAsROP.length > 0
    const hasSubordinates = employee.subordinates.length > 0

    if (hasDeals) {
      return NextResponse.json({ error: 'Нельзя удалить сотрудника: он привязан к сделкам. Поставьте статус “Уволен”.' }, { status: 409 })
    }

    if (hasSubordinates) {
      return NextResponse.json({ error: 'Нельзя удалить сотрудника: он указан руководителем у других сотрудников. Сначала переназначьте РОПа.' }, { status: 409 })
    }

    await db.employee.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Нельзя удалить сотрудника: есть связанные записи. Поставьте статус “Уволен” или отвяжите связи.' },
        { status: 409 }
      )
    }
    console.error('Error deleting employee:', error)
    return NextResponse.json({ error: 'Не удалось удалить сотрудника' }, { status: 500 })
  }
}
