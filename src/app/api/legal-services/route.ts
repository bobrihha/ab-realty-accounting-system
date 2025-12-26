import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'

export async function GET(request: NextRequest) {
    try {
        const session = await requireSession()
        if (session.role === 'AGENT' || session.role === 'ROP') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const legalServices = await db.legalService.findMany({
            orderBy: { serviceDate: 'desc' }
        })

        return NextResponse.json(legalServices)
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error fetching legal services:', error)
        return NextResponse.json(
            { error: 'Failed to fetch legal services' },
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

        const legalService = await db.legalService.create({
            data: {
                client: String(data.client ?? ''),
                amount: Number(data.amount ?? 0),
                serviceDate: data.serviceDate ? new Date(data.serviceDate) : new Date(),
                description: data.description ? String(data.description) : null
            }
        })

        return NextResponse.json(legalService, { status: 201 })
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error creating legal service:', error)
        return NextResponse.json(
            { error: 'Failed to create legal service' },
            { status: 500 }
        )
    }
}
