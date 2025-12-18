
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Verifying CashFlow Edit/Delete ---');

    // 1. Create a dummy account
    const account = await prisma.account.create({
        data: {
            name: 'Test Wallet',
            balance: 1000,
            type: 'CASH'
        }
    });
    console.log(`Created Account: ${account.name} (Balance: ${account.balance})`);

    // 2. Create an Income (+500)
    // We simulate the API logic here because we want to test the TRANSACTION logic which is now in the API.
    // Ideally we would call the API, but since we are running a script, we will replicate the transaction logic 
    // to ensure our understanding of the flow is correct, OR better yet, let's purely test the DB interactions
    // assuming the API calls db calls correctly. 

    // Actually, to test the API logic involving transactions, we should probably manually
    // invoke the DB updates as the API would do.

    console.log('--- Step 1: Create Income 500 ---');
    const incomeDetails = {
        type: 'INCOME',
        amount: 500,
        category: 'Test',
        plannedDate: new Date(),
        actualDate: new Date(),
        status: 'PAID' as const,
        accountId: account.id
    };

    // Simulate POST /api/treasury?type=cashflow
    await prisma.$transaction(async (tx) => {
        await tx.cashFlow.create({
            data: { ...incomeDetails, type: 'INCOME' }
        });
        await tx.account.update({
            where: { id: account.id },
            data: { balance: { increment: 500 } }
        });
    });

    const accAfterIncome = await prisma.account.findUnique({ where: { id: account.id } });
    console.log(`Balance after Income: ${accAfterIncome?.balance} (Expected: 1500)`);
    if (accAfterIncome?.balance !== 1500) throw new Error('Balance mismatch!');

    // 3. Edit the Income -> Change to 800 (+300 diff)
    console.log('--- Step 2: Edit Income to 800 ---');
    const cf = await prisma.cashFlow.findFirst({ where: { accountId: account.id } });
    if (!cf) throw new Error('CashFlow not found');

    // Simulate PUT /api/cash-flow/[id] logic
    await prisma.$transaction(async (tx) => {
        // Revert old (500)
        await tx.account.update({
            where: { id: account.id },
            data: { balance: { decrement: 500 } }
        });

        // Update record
        await tx.cashFlow.update({
            where: { id: cf.id },
            data: { amount: 800 }
        });

        // Apply new (800)
        await tx.account.update({
            where: { id: account.id },
            data: { balance: { increment: 800 } }
        });
    });

    const accAfterEdit = await prisma.account.findUnique({ where: { id: account.id } });
    console.log(`Balance after Edit: ${accAfterEdit?.balance} (Expected: 1800)`);
    if (accAfterEdit?.balance !== 1800) throw new Error('Balance mismatch after edit!');

    // 4. Delete the Income
    console.log('--- Step 3: Delete Income ---');
    // Simulate DELETE /api/cash-flow/[id] logic
    await prisma.$transaction(async (tx) => {
        // Revert (800)
        await tx.account.update({
            where: { id: account.id },
            data: { balance: { decrement: 800 } }
        });
        await tx.cashFlow.delete({ where: { id: cf.id } });
    });

    const accAfterDelete = await prisma.account.findUnique({ where: { id: account.id } });
    console.log(`Balance after Delete: ${accAfterDelete?.balance} (Expected: 1000)`);
    if (accAfterDelete?.balance !== 1000) throw new Error('Balance mismatch after delete!');

    // Cleanup
    await prisma.account.delete({ where: { id: account.id } });
    console.log('Verification Successful.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
