import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || (session as any).role !== 'OWNER') {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const credentials = await db.credential.findMany({
            orderBy: { createdAt: 'desc' }
        })
        return NextResponse.json(credentials)
    } catch (error) {
        console.error('Error fetching credentials:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || (session as any).role !== 'OWNER') {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        const body = await req.json()
        const credential = await db.credential.create({
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
        console.error('Error creating credential:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
