import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'
import { hash } from 'bcryptjs'

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession()
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const status = searchParams.get('status')

    const where: any = {}
    if (role && role !== 'all') where.role = role.toUpperCase()
    if (status && status !== 'all') where.status = status.toUpperCase()

    if (session.role === 'AGENT') {
      where.id = session.userId
    } else if (session.role === 'ROP') {
      where.OR = [{ id: session.userId }, { managerId: session.userId }]
    }

    const employees = await db.employee.findMany({
      where,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      include: { commissionRates: true }
    })

    return NextResponse.json(employees)
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching employees:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()
    const passwordHash = data.password ? await hash(String(data.password), 10) : null

    const employee = await db.employee.create({
      data: {
        name: String(data.name ?? ''),
        email: String(data.email ?? '').trim().toLowerCase(),
        phone: String(data.phone ?? ''),
        role: String(data.role ?? 'AGENT').toUpperCase(),
        status: String(data.status ?? 'ACTIVE').toUpperCase(),
        department: data.department ? String(data.department) : null,
        hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
        terminationDate: data.terminationDate ? new Date(data.terminationDate) : null,
        baseRateAgent: data.baseRateAgent !== undefined ? Number(data.baseRateAgent) : null,
        baseRateROP: data.baseRateROP !== undefined ? Number(data.baseRateROP) : null,
        managerId: data.managerId ?? null,
        passwordHash
      },
      include: { commissionRates: true }
    })

    return NextResponse.json(employee, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating employee:', error)
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    )
  }
}
