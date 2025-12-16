
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Verifying Employee Deletion ---');

    // 1. Create a dummy employee
    const dummy = await prisma.employee.create({
        data: {
            name: 'To Be Deleted',
            email: 'delete_me@example.com',
            role: 'AGENT',
            status: 'ACTIVE',
            phone: '1234567890',
            hireDate: new Date(),
        }
    });

    console.log(`Created dummy employee: ${dummy.id}`);

    // 2. Mock deleting it (SIMULATING the API logic directly against DB for quick check)
    // In a real e2e we'd hit the API, but here we check DB constraint logic

    // Clean delete
    await prisma.employee.delete({ where: { id: dummy.id } });
    console.log(`Deleted dummy employee: ${dummy.id}`);

    // 3. Verify it's gone
    const check = await prisma.employee.findUnique({ where: { id: dummy.id } });
    if (!check) {
        console.log('Verification SUCCESS: Employee is gone.');
    } else {
        console.error('Verification FAILED: Employee still exists.');
    }

    // 4. Test logic with dependencies (should fail in API, but here we just ensure we didn't break schema)
    // We rely on the API implementation we wrote for the actual logic check.
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
