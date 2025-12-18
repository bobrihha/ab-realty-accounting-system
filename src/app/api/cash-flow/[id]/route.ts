import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'

function signedAmount(type: 'INCOME' | 'EXPENSE', amount: number) {
  return (type === 'INCOME' ? 1 : -1) * amount
}

function canEditTreasury(role: string) {
  return role === 'OWNER' || role === 'ACCOUNTANT'
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession()
    if (!canEditTreasury(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const existing = await db.cashFlow.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data = await request.json()
    const nextType = String(data.type ?? existing.type).toUpperCase() as 'INCOME' | 'EXPENSE'
    const nextAmount = Number(data.amount ?? existing.amount)
    const nextPlannedDate = data.plannedDate ? new Date(data.plannedDate) : existing.plannedDate
    const nextStatus = String(data.status ?? (data.actualDate === null ? 'PLANNED' : data.actualDate ? 'PAID' : existing.status)).toUpperCase() as
      | 'PLANNED'
      | 'PAID'
    const nextActualDate =
      nextStatus === 'PAID'
        ? data.actualDate
          ? new Date(data.actualDate)
          : existing.actualDate ?? nextPlannedDate
        : null
    const nextAccountIdRaw = data.accountId === null ? null : data.accountId !== undefined ? String(data.accountId) : existing.accountId
    const nextAccountId = nextStatus === 'PLANNED' && data.accountId === undefined ? null : nextAccountIdRaw
    const nextCategory = data.category ?? existing.category
    const nextDescription = data.description === null ? null : data.description ?? existing.description

    if (nextStatus === 'PAID' && !nextAccountId) {
      return NextResponse.json({ error: 'accountId is required for PAID operations' }, { status: 400 })
    }

    const oldPaid = existing.status === 'PAID' && !!existing.actualDate && !!existing.accountId
    const newPaid = nextStatus === 'PAID' && !!nextActualDate && !!nextAccountId
    const oldDelta = oldPaid ? signedAmount(existing.type, existing.amount) : 0
    const newDelta = newPaid ? signedAmount(nextType, nextAmount) : 0

    await db.$transaction(async tx => {
      if (oldPaid && existing.accountId) {
        if (!newPaid) {
          await tx.account.update({ where: { id: existing.accountId }, data: { balance: { increment: -oldDelta } } })
        } else if (existing.accountId === nextAccountId) {
          const diff = newDelta - oldDelta
          if (diff !== 0) {
            await tx.account.update({ where: { id: existing.accountId }, data: { balance: { increment: diff } } })
          }
        } else {
          await tx.account.update({ where: { id: existing.accountId }, data: { balance: { increment: -oldDelta } } })
        }
      }

      if (newPaid && nextAccountId) {
        if (!oldPaid) {
          await tx.account.update({ where: { id: nextAccountId }, data: { balance: { increment: newDelta } } })
        } else if (existing.accountId !== nextAccountId) {
          await tx.account.update({ where: { id: nextAccountId }, data: { balance: { increment: newDelta } } })
        }
      }

      await tx.cashFlow.update({
        where: { id },
        data: {
          type: nextType,
          amount: nextAmount,
          category: nextCategory,
          status: nextStatus,
          plannedDate: nextPlannedDate,
          actualDate: nextActualDate,
          description: nextDescription,
          accountId: nextAccountId
        }
      })
    })

    const updated = await db.cashFlow.findUnique({ where: { id }, include: { account: true } })
    return NextResponse.json(updated)
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Error updating cash flow:', error)
    return NextResponse.json({ error: 'Failed to update cash flow' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession()
    if (!canEditTreasury(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const existing = await db.cashFlow.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const oldPaid = existing.status === 'PAID' && !!existing.actualDate && !!existing.accountId
    const oldDelta = oldPaid ? signedAmount(existing.type, existing.amount) : 0

    await db.$transaction(async tx => {
      if (oldDelta !== 0 && existing.accountId) {
        await tx.account.update({ where: { id: existing.accountId }, data: { balance: { increment: -oldDelta } } })
      }
      await tx.cashFlow.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Error deleting cash flow:', error)
    return NextResponse.json({ error: 'Failed to delete cash flow' }, { status: 500 })
  }
}
