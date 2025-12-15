import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'
import { hash } from 'bcryptjs'

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
