import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from '@/lib/money'

export async function GET(request: NextRequest) {
    try {
        const session = await requireSession()
        if (session.role === 'AGENT' || session.role === 'ROP') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const year = Number(searchParams.get('year') ?? new Date().getFullYear())
        const month = searchParams.get('month') ? Number(searchParams.get('month')) : null

        let fromDate: Date
        let toDate: Date

        if (month !== null) {
            const date = new Date(year, month - 1, 1)
            fromDate = startOfMonth(date)
            toDate = endOfMonth(date)
        } else {
            const date = new Date(year, 0, 1)
            fromDate = startOfYear(date)
            toDate = endOfYear(date)
        }

        // Юр.услуги из сделок (по dealDate)
        const dealLegalServices = await db.deal.aggregate({
            where: {
                legalServices: true,
                dealDate: { gte: fromDate, lte: toDate }
            },
            _sum: { legalServicesAmount: true },
            _count: { id: true }
        })

        // Отдельные юр.услуги (по serviceDate)
        const standaloneLegalServices = await db.legalService.aggregate({
            where: {
                serviceDate: { gte: fromDate, lte: toDate }
            },
            _sum: { amount: true },
            _count: { id: true }
        })

        const dealCount = dealLegalServices._count.id ?? 0
        const dealAmount = dealLegalServices._sum.legalServicesAmount ?? 0
        const standaloneCount = standaloneLegalServices._count.id ?? 0
        const standaloneAmount = standaloneLegalServices._sum.amount ?? 0

        return NextResponse.json({
            period: month ? `${year}-${String(month).padStart(2, '0')}` : String(year),
            deals: {
                count: dealCount,
                amount: dealAmount
            },
            standalone: {
                count: standaloneCount,
                amount: standaloneAmount
            },
            total: {
                count: dealCount + standaloneCount,
                amount: dealAmount + standaloneAmount
            }
        })
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error fetching legal services stats:', error)
        return NextResponse.json(
            { error: 'Failed to fetch legal services stats' },
            { status: 500 }
        )
    }
}
