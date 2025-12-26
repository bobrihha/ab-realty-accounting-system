import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'
import { endOfMonth, startOfMonth } from '@/lib/money'

export async function GET() {
  try {
    const session = await requireSession()
    if (session.role !== 'AGENT' && session.role !== 'ROP') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const from = startOfMonth(now)
    const to = endOfMonth(now)

    const whereBase = session.role === 'AGENT' ? { agentId: session.userId } : { ropId: session.userId }
    const commissionField = session.role === 'AGENT' ? 'agentCommission' : 'ropCommission'

    const earnedDeals = await db.deal.findMany({
      where: { ...whereBase, dealDate: { gte: from, lte: to }, NOT: { status: 'CANCELLED' } },
      select: { id: true, client: true, object: true, commission: true, agentCommission: true, ropCommission: true, dealDate: true }
    })

    const pipelineDeals = await db.deal.findMany({
      where: { ...whereBase, dealDate: null, NOT: { status: 'CANCELLED' } },
      select: { id: true, client: true, object: true, commission: true, agentCommission: true, ropCommission: true, plannedCloseDate: true }
    })

    const earned = earnedDeals.reduce((s, d) => s + (Number((d as any)[commissionField]) || 0), 0)
    const expected = pipelineDeals.reduce((s, d) => s + (Number((d as any)[commissionField]) || 0), 0)

    return NextResponse.json({
      role: session.role,
      month: now.toLocaleString('ru-RU', { month: 'long', year: 'numeric' }),
      earned,
      expected,
      earnedDeals,
      pipelineDeals
    })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching compensation:', error)
    return NextResponse.json({ error: 'Failed to fetch compensation' }, { status: 500 })
  }
}

