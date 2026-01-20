import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session || (session as any).role !== 'OWNER') {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const body = await req.json()
        const credential = await db.credential.update({
            where: { id: params.id },
            data: {
                title: body.title,
                category: body.category,
                url: body.url,
                login: body.login,
                password: body.password,
                description: body.description
            }
        })
        return NextResponse.json(credential)
    } catch (error) {
        console.error('Error updating credential:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session || (session as any).role !== 'OWNER') {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        await db.credential.delete({
            where: { id: params.id }
        })
        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error('Error deleting credential:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
