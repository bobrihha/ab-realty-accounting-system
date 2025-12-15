import { hash } from 'bcryptjs'
import { db } from '../src/lib/db'

async function main() {
  const ownerEmail = 'owner@agency.local'
  const ownerPassword = 'owner12345'
  const passwordHash = await hash(ownerPassword, 10)

  const existing = await db.employee.findUnique({ where: { email: ownerEmail } })
  if (existing) {
    await db.employee.update({
      where: { email: ownerEmail },
      data: { passwordHash, role: 'OWNER', status: 'ACTIVE' }
    })
    console.log(`Updated owner user: ${ownerEmail}`)
    console.log(`Password: ${ownerPassword}`)
    return
  }

  await db.employee.create({
    data: {
      name: 'Владелец',
      email: ownerEmail,
      phone: '+7 (000) 000-00-00',
      role: 'OWNER',
      status: 'ACTIVE',
      hireDate: new Date(),
      passwordHash
    }
  })

  console.log(`Created owner user: ${ownerEmail}`)
  console.log(`Password: ${ownerPassword}`)
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
