import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { db } from '@/lib/db'

export type AppRole = 'AGENT' | 'ROP' | 'OWNER' | 'ACCOUNTANT' | 'LAWYER'

function normalizeRole(role: string | null | undefined): AppRole {
  switch ((role ?? '').toUpperCase()) {
    case 'AGENT':
      return 'AGENT'
    case 'ROP':
      return 'ROP'
    case 'ACCOUNTANT':
      return 'ACCOUNTANT'
    case 'OWNER':
      return 'OWNER'
    case 'LAWYER':
      return 'LAWYER'
    default:
      return 'AGENT'
  }
}

export const authOptions: NextAuthOptions = {
  pages: { signIn: '/auth/signin' },
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password ?? ''

        if (!email || !password) return null

        const employee = await db.employee.findUnique({ where: { email } })
        if (!employee?.passwordHash) return null

        const ok = await compare(password, employee.passwordHash)
        if (!ok) return null

        return {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: normalizeRole(employee.role)
        } as any
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = (user as any).id
          ; (token as any).role = (user as any).role
      } else {
        // Backward/edge-case compatibility: if role is missing in an existing token, hydrate it from DB.
        if (token.sub && !(token as any).role) {
          const employee = await db.employee.findUnique({ where: { id: token.sub } })
            ; (token as any).role = normalizeRole(employee?.role)
        }
      }
      return token
    },
    async session({ session, token }) {
      ; (session as any).userId = token.sub
        ; (session as any).role = (token as any).role
      return session
    }
  }
}
