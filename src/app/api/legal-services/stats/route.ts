import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'
import { startOfYear, endOfYear, monthKey, formatMonthLabel } from '@/lib/money'

// ЗП юриста по умолчанию - 60%
const DEFAULT_LAWYER_RATE = 60

export async function GET(request: NextRequest) {
    try {
        const session = await requireSession()
        if (session.role === 'AGENT' || session.role === 'ROP') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const year = Number(searchParams.get('year') ?? new Date().getFullYear())
        const lawyerRate = Number(searchParams.get('lawyerRate') ?? DEFAULT_LAWYER_RATE)

        const fromDate = startOfYear(new Date(year, 0, 1))
        const toDate = endOfYear(new Date(year, 11, 31))

        // Юр.услуги из сделок (по dealDate)
        const dealLegalServices = await db.deal.findMany({
            where: {
                legalServices: true,
                dealDate: { gte: fromDate, lte: toDate }
            },
            select: {
                id: true,
                dealDate: true,
                legalServicesAmount: true
            }
        })

        // Отдельные юр.услуги (по serviceDate)
        const standaloneLegalServices = await db.legalService.findMany({
            where: {
                serviceDate: { gte: fromDate, lte: toDate }
            },
            select: {
                id: true,
                serviceDate: true,
                amount: true
            }
        })

        // Группируем по месяцам
        const months: Record<string, { dealsCount: number; dealsAmount: number; standaloneCount: number; standaloneAmount: number }> = {}

        // Инициализируем все месяцы года
        for (let m = 0; m < 12; m++) {
            const mk = monthKey(new Date(year, m, 1))
            months[mk] = { dealsCount: 0, dealsAmount: 0, standaloneCount: 0, standaloneAmount: 0 }
        }

        // Добавляем сделки
        for (const deal of dealLegalServices) {
            if (!deal.dealDate) continue
            const mk = monthKey(deal.dealDate)
            if (months[mk]) {
                months[mk].dealsCount += 1
                months[mk].dealsAmount += Number(deal.legalServicesAmount ?? 0)
            }
        }

        // Добавляем отдельные услуги
        for (const service of standaloneLegalServices) {
            const mk = monthKey(service.serviceDate)
            if (months[mk]) {
                months[mk].standaloneCount += 1
                months[mk].standaloneAmount += Number(service.amount ?? 0)
            }
        }

        // Формируем результат с ЗП юриста
        const monthlyData = Object.entries(months)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mk, data]) => {
                const totalAmount = data.dealsAmount + data.standaloneAmount
                const totalCount = data.dealsCount + data.standaloneCount
                const lawyerSalary = Math.round(totalAmount * lawyerRate / 100)
                return {
                    monthKey: mk,
                    month: formatMonthLabel(mk),
                    dealsCount: data.dealsCount,
                    dealsAmount: data.dealsAmount,
                    standaloneCount: data.standaloneCount,
                    standaloneAmount: data.standaloneAmount,
                    totalCount,
                    totalAmount,
                    lawyerSalary
                }
            })

        // Итоги за год
        const totals = monthlyData.reduce((acc, m) => ({
            dealsCount: acc.dealsCount + m.dealsCount,
            dealsAmount: acc.dealsAmount + m.dealsAmount,
            standaloneCount: acc.standaloneCount + m.standaloneCount,
            standaloneAmount: acc.standaloneAmount + m.standaloneAmount,
            totalCount: acc.totalCount + m.totalCount,
            totalAmount: acc.totalAmount + m.totalAmount,
            lawyerSalary: acc.lawyerSalary + m.lawyerSalary
        }), {
            dealsCount: 0, dealsAmount: 0, standaloneCount: 0, standaloneAmount: 0,
            totalCount: 0, totalAmount: 0, lawyerSalary: 0
        })

        return NextResponse.json({
            year,
            lawyerRate,
            months: monthlyData,
            totals
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
