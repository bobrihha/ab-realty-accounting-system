import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'

function canEditTreasury(role: string) {
  return role === 'OWNER' || role === 'ACCOUNTANT'
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession()
    if (!canEditTreasury(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const data = await request.json()
    const updated = await db.account.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        type: data.type ? (String(data.type).toUpperCase() as any) : undefined,
        balance: data.balance !== undefined ? Number(data.balance) : undefined
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Error updating account:', error)
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession()
    if (!canEditTreasury(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    await db.account.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Error deleting account:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}

