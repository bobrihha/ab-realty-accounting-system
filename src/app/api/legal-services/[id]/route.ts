import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSession } from '@/lib/guards'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireSession()
        if (session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const existing = await db.legalService.findUnique({ where: { id } })
        if (!existing) {
            return NextResponse.json({ error: 'Legal service not found' }, { status: 404 })
        }

        const data = await request.json()

        const legalService = await db.legalService.update({
            where: { id },
            data: {
                client: data.client !== undefined ? String(data.client) : undefined,
                amount: data.amount !== undefined ? Number(data.amount) : undefined,
                serviceDate: data.serviceDate ? new Date(data.serviceDate) : undefined,
                description: data.description !== undefined ? (data.description ? String(data.description) : null) : undefined
            }
        })

        return NextResponse.json(legalService)
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error updating legal service:', error)
        return NextResponse.json(
            { error: 'Failed to update legal service' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireSession()
        if (session.role !== 'OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const existing = await db.legalService.findUnique({ where: { id } })
        if (!existing) {
            return NextResponse.json({ error: 'Legal service not found' }, { status: 404 })
        }

        await db.legalService.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        if ((error as Error).message === 'UNAUTHORIZED') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        console.error('Error deleting legal service:', error)
        return NextResponse.json(
            { error: 'Failed to delete legal service' },
            { status: 500 }
        )
    }
}
