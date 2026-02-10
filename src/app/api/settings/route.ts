import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guards'
import { db } from '@/lib/db'
import { getAppSettings } from '@/lib/app-settings'

function normalizeStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null
    const items = value
        .map(v => String(v ?? '').trim())
        .filter(v => v.length > 0)
    return items.length > 0 ? items : null
}

function normalizeExpenseBlocks(value: unknown) {
    if (!Array.isArray(value)) return null
    const blocks = value
        .map(block => {
            if (!block || typeof block !== 'object') return null
            const name = String((block as any).name ?? '').trim()
            const categoriesRaw = (block as any).categories
            const categories = normalizeStringArray(categoriesRaw) ?? []
            if (!name) return null
            return { name, categories }
        })
        .filter(Boolean)
    return blocks.length > 0 ? blocks : null
}

export async function GET() {
    try {
        const session = await requireSession()
        if (session.role !== 'OWNER' && session.role !== 'ACCOUNTANT') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const settings = await getAppSettings()
        return NextResponse.json(settings)
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error fetching app settings:', error)
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await requireSession()
        if (session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const data = await request.json()

        const cashflowIncomeCategories = normalizeStringArray(data.cashflowIncomeCategories)
        const cashflowExpenseCategories = normalizeStringArray(data.cashflowExpenseCategories)
        const cashflowExpenseBlocks = normalizeExpenseBlocks(data.cashflowExpenseBlocks)

        const settings = await db.appSettings.upsert({
            where: { id: 'default' },
            update: {
                cashflowIncomeCategories,
                cashflowExpenseCategories,
                cashflowExpenseBlocks
            },
            create: {
                id: 'default',
                cashflowIncomeCategories,
                cashflowExpenseCategories,
                cashflowExpenseBlocks
            }
        })

        return NextResponse.json(settings)
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error updating app settings:', error)
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }
}
