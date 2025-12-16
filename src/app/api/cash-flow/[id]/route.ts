import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'

function signedAmount(type: 'INCOME' | 'EXPENSE', amount: number) {
  return (type === 'INCOME' ? 1 : -1) * amount
}

function canEditTreasury(role: string) {
  return role === 'OWNER' || role === 'ACCOUNTANT'
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    if (!canEditTreasury(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const existing = await db.cashFlow.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data = await request.json()
    const nextType = String(data.type ?? existing.type).toUpperCase() as 'INCOME' | 'EXPENSE'
    const nextAmount = Number(data.amount ?? existing.amount)
    const nextAccountId = String(data.accountId ?? existing.accountId)
    const nextPlannedDate = data.plannedDate ? new Date(data.plannedDate) : existing.plannedDate
    const nextActualDate = data.actualDate === null ? null : data.actualDate ? new Date(data.actualDate) : existing.actualDate
    const nextCategory = data.category ?? existing.category
    const nextDescription = data.description === null ? null : data.description ?? existing.description

    const oldDelta = existing.actualDate ? signedAmount(existing.type, existing.amount) : 0
    const newDelta = nextActualDate ? signedAmount(nextType, nextAmount) : 0

    await db.$transaction(async tx => {
      if (existing.accountId === nextAccountId) {
        const diff = newDelta - oldDelta
        if (diff !== 0) {
          await tx.account.update({ where: { id: existing.accountId }, data: { balance: { increment: diff } } })
        }
      } else {
        if (oldDelta !== 0) {
          await tx.account.update({ where: { id: existing.accountId }, data: { balance: { increment: -oldDelta } } })
        }
        if (newDelta !== 0) {
          await tx.account.update({ where: { id: nextAccountId }, data: { balance: { increment: newDelta } } })
        }
      }

      await tx.cashFlow.update({
        where: { id: params.id },
        data: {
          type: nextType,
          amount: nextAmount,
          category: nextCategory,
          plannedDate: nextPlannedDate,
          actualDate: nextActualDate,
          description: nextDescription,
          accountId: nextAccountId
        }
      })
    })

    const updated = await db.cashFlow.findUnique({ where: { id: params.id }, include: { account: true } })
    return NextResponse.json(updated)
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Error updating cash flow:', error)
    return NextResponse.json({ error: 'Failed to update cash flow' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    if (!canEditTreasury(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const existing = await db.cashFlow.findUnique({ where: { id: params.id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const oldDelta = existing.actualDate ? signedAmount(existing.type, existing.amount) : 0

    await db.$transaction(async tx => {
      if (oldDelta !== 0) {
        await tx.account.update({ where: { id: existing.accountId }, data: { balance: { increment: -oldDelta } } })
      }
      await tx.cashFlow.delete({ where: { id: params.id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Error deleting cash flow:', error)
    return NextResponse.json({ error: 'Failed to delete cash flow' }, { status: 500 })
  }
}

