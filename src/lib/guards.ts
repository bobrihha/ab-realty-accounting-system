import { getServerSession } from 'next-auth'
import { authOptions, type AppRole } from '@/lib/auth'

export type SessionUser = {
  userId: string
  role: AppRole
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getServerSession(authOptions)
  const userId = (session as any)?.userId as string | undefined
  const role = (session as any)?.role as AppRole | undefined
  if (!userId || !role) throw new Error('UNAUTHORIZED')
  return { userId, role }
}

export function canViewAllDeals(role: AppRole) {
  return role === 'OWNER' || role === 'ACCOUNTANT' || role === 'LAWYER'
}

export function canAccessLegalServices(role: AppRole) {
  return role === 'OWNER' || role === 'ACCOUNTANT' || role === 'LAWYER'
}
