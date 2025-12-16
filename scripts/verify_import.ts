
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const employees = await prisma.employee.count();
    const deals = await prisma.deal.count();
    const cashFlows = await prisma.cashFlow.count();
    const accounts = await prisma.account.count();

    console.log('--- Import Verification ---');
    console.log(`Employees: ${employees}`);
    console.log(`Deals: ${deals}`);
    console.log(`Cash Flow items: ${cashFlows}`);
    console.log(`Accounts: ${accounts}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
